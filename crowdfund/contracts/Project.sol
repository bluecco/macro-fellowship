//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract Project is ERC721 {
    event Contribution(
        address indexed from,
        address indexed project,
        uint256 amount
    );
    event ProjectCancelled(address indexed project);
    event Refund(address indexed to, address indexed project, uint256 amount);
    event Withdraw(address indexed to, address indexed project, uint256 amount);

    address public owner;
    uint256 public goal;
    uint256 public endAt;
    uint256 public fundsRaised;
    bool public isCancelled = false;
    bool public isComplete = false;

    mapping(address => uint256) public addressToContribution;
    mapping(address => uint256) public addressToBadges;

    uint256 public totalMints = 0;

    uint256 public constant MIN_CONTRIBUTION = 0.01 ether;

    /// @param _name The name of the fundraising project (to be used in the NFT badges)
    /// @param _tokenSymbol NFT token symbol
    /// @param _owner The owner of the project
    /// @param _goal Ethers needed for the project fundraising
    constructor(
        string memory _name,
        string memory _tokenSymbol,
        address _owner,
        uint256 _goal,
        uint256 _endAt
    ) ERC721(_name, _tokenSymbol) {
        owner = _owner;
        goal = _goal;
        endAt = _endAt;
        fundsRaised = 0;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Project: not creator");
        _;
    }

    modifier isNotComplete() {
        require(!isComplete, "Project: goal reached");
        _;
    }

    modifier isNotCancelled() {
        require(!isCancelled, "Project: cancelled");
        _;
    }

    modifier isNotExpired() {
        require(block.timestamp < endAt, "Project: expired");
        _;
    }

    /// @notice Allows addresses to contribute if the project with the following conditions:
    /// is not fully funded
    /// is not expired
    /// has not been cancelled
    /// @dev If a contribution put the contract balance over the goal, the project is set as complete
    function contribute()
        external
        payable
        isNotComplete
        isNotCancelled
        isNotExpired
    {
        require(msg.value >= MIN_CONTRIBUTION, "Project: min 0.01 ether");

        if (fundsRaised + msg.value >= goal) {
            isComplete = true;
        }

        addressToContribution[msg.sender] += msg.value;
        fundsRaised += msg.value;

        emit Contribution(msg.sender, address(this), msg.value);
    }

    /// @notice Allows creators to cancel the project with the following conditions:
    /// is not already cancelled
    /// is not fully funded
    /// is not expired
    function cancel()
        public
        onlyOwner
        isNotComplete
        isNotCancelled
        isNotExpired
    {
        isCancelled = true;
        emit ProjectCancelled(address(this));
    }

    /// @notice Allows contributors to get a refund with the following conditions:
    /// is not fully funded
    /// is expired or cancelled
    /// contributor made a contribution
    function refund() public isNotComplete {
        require(
            isCancelled || block.timestamp >= endAt,
            "Project: not cancelled or not expired"
        );
        require(
            addressToContribution[msg.sender] > 0,
            "Project: no contribution"
        );
        uint256 amount = addressToContribution[msg.sender];
        addressToContribution[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Project: refund failed");

        emit Refund(msg.sender, address(this), amount);
    }

    /// @notice Allows the owner to get a withdraw the funds raised with the following conditions:
    /// is not cancelled
    /// goal is reached
    /// amount to withdraw is more than 0
    /// amount to withdraw is lower or equal the contract balance
    /// @param _amount The amount of ether to withdraw
    function withdrawFunds(uint256 _amount) public onlyOwner isNotCancelled {
        require(isComplete, "Project: project failed!");
        require(_amount > 0, "Project: amount must > 0");
        require(
            _amount <= address(this).balance && _amount <= fundsRaised,
            "Project: not enough balance"
        );
        fundsRaised -= _amount;

        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "Project: withdraw failed");

        emit Withdraw(msg.sender, address(this), _amount);
    }

    /// @notice mint of NFT badges for qualified contributors
    /// @dev token minted using _safeMint from ERC271
    function mintBadges() public {
        require(
            addressToBadges[msg.sender] <
                addressToContribution[msg.sender] / 1 ether
        );

        uint256 quantity = (addressToContribution[msg.sender] / 1 ether) -
            addressToBadges[msg.sender];
        addressToBadges[msg.sender] += quantity;

        for (uint256 i; i < quantity; i++) {
            uint256 tokenId = totalMints;
            totalMints++;
            _safeMint(msg.sender, tokenId);
        }
    }

    /// @notice transfer NFT badges ownership if it's the owner
    /// @dev token traded using safeTransferFrom from ERC271
    /// @param _to address of the new owner
    /// @param _id tokenId of thr NFT
    function tradeBadge(address _to, uint256 _id) public {
        require(ownerOf(_id) == msg.sender, "Not the owner");
        safeTransferFrom(msg.sender, _to, _id);
    }
}
