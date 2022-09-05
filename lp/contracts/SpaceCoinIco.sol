// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./SpaceCoin.sol";

contract SpaceCoinIco {
    uint256 public constant GOAL = 30000 ether;
    uint256 public constant SEED_PHASE_GOAL = 15000 ether;
    uint256 private constant SEED_PHASE_PERSONAL_LIMIT = 1500 ether;
    uint256 private constant GENERAL_PHASE_PERSONAL_LIMIT = 1000 ether;
    uint256 private constant RATE = 5;
    uint256 public amountRaised;

    address private immutable _owner;
    address private immutable treasury;

    mapping(address => uint256) public addressToContribution;
    mapping(address => uint256) public addressToTokenDistribute;
    mapping(address => bool) private allowlistPrivateInvestors;

    bool public paused;

    SpaceCoin private immutable _token;

    enum IcoPhase {
        SEED,
        GENERAL,
        OPEN
    }

    IcoPhase public currentPhase;

    /**
     * @param _tokenAddress Address of the ERC20 token contract
     * @param investors List of addresses to whitelist for Seed phase
     */
    constructor(
        address _tokenAddress,
        address _treasury,
        address[] memory investors
    ) {
        _owner = msg.sender;
        _token = SpaceCoin(_tokenAddress);
        currentPhase = IcoPhase.SEED;
        treasury = _treasury;

        for (uint256 i = 0; i < investors.length; i++) {
            allowlistPrivateInvestors[investors[i]] = true;
        }
    }

    /// @dev check sender is the owner
    modifier onlyOwner() {
        if (_owner != msg.sender) {
            revert MustBeOwner("NOT_OWNER");
        }
        _;
    }

    /// @dev check if investor can contribute in Seed Phase
    modifier onlyIfAllowed() {
        if (currentPhase == IcoPhase.SEED && !allowlistPrivateInvestors[msg.sender]) {
            revert MustBeAllowed("NOT_ALLOWED", msg.sender);
        }
        _;
    }

    /**
     *
     * @dev check if investor has tokens to claim
     *
     */
    modifier hasClaimableTokens() {
        /* kept as modifier for readability on method claimTokens
         * frontend will use to addressToTokenDistribute check the quantity
         */
        if (addressToTokenDistribute[msg.sender] <= 0) {
            revert MustHaveClaimableTokens("NO_CLAIMABLE_TOKENS", msg.sender);
        }
        _;
    }

    /// @dev Check if ICO is in Open phase
    modifier onlyOpenPhase() {
        if (currentPhase != IcoPhase.OPEN) {
            revert WrongPhase("NOT_OPEN_PHASE");
        }
        _;
    }

    /// @dev Check if ICO is in Open phase
    modifier canAdvance() {
        if (currentPhase == IcoPhase.OPEN) {
            revert WrongPhase("ALREADY_IN_OPEN_PHASE");
        }
        _;
    }

    /// @dev Check if goal is reached, used by frontend
    function hasReachedIcoGoal() external view returns (bool) {
        return amountRaised == GOAL;
    }

    /**
     * @dev Performs all the checks on the current contributions
     *
     * @param amount Value of the current contribution sent by an investor
     * plus the amount already invested
     */
    function canContributeUnderLimit(
        uint256 amount,
        uint256 limit,
        string memory message
    ) internal pure {
        if (amount > limit) {
            revert MustBeUnderLimit(message, amount, limit);
        }
    }

    /**
     * @dev Performs a contribution to the ICO
     *
     * Perform checks before proceeding to add funds
     * If phase is Seed or General, SPC tokens will be stored and be claimable in Open phase
     * If phase is Open, issue SPC tokens
     *
     */
    function contribute() external payable onlyIfAllowed {
        if (paused) revert MustBeActive("ICO_IS_PAUSED");
        if (msg.value <= 0) revert MustBeGreaterThanZero("AMOUNT_IS_ZERO");

        uint256 investorContribution = addressToContribution[msg.sender] + msg.value;
        uint256 totalContribution = amountRaised + msg.value;

        // divide checks per phase, improve readability imho
        if (currentPhase == IcoPhase.SEED) {
            canContributeUnderLimit(investorContribution, SEED_PHASE_PERSONAL_LIMIT, "ABOVE_PERSONAL_LIMIT");
            canContributeUnderLimit(totalContribution, SEED_PHASE_GOAL, "ABOVE_ICO_GOAL_LIMIT");
        }

        if (currentPhase == IcoPhase.GENERAL) {
            canContributeUnderLimit(investorContribution, GENERAL_PHASE_PERSONAL_LIMIT, "ABOVE_PERSONAL_LIMIT");
        }

        if (currentPhase != IcoPhase.SEED) {
            canContributeUnderLimit(totalContribution, GOAL, "ABOVE_ICO_GOAL_LIMIT");
        }

        uint256 amount = msg.value;

        amountRaised += amount;
        addressToContribution[msg.sender] += amount;

        if (currentPhase == IcoPhase.SEED || currentPhase == IcoPhase.GENERAL) {
            /*
             * calcEligibleTokens could be passed as parameter to _token.transfer
             * but prefer this for readability
             */
            uint256 tokenToClaim = calcEligibleTokens(addressToContribution[msg.sender]);
            addressToTokenDistribute[msg.sender] = tokenToClaim;

            emit Contribute(msg.sender, msg.value);

            return;
        }

        /*
         * calcEligibleTokens could be passed as parameter to _token.transfer
         * but prefer this for readability
         */
        uint256 tokenToAssign = calcEligibleTokens(msg.value);

        require(_token.transfer(msg.sender, tokenToAssign), "SPC_TRANSFER_FAILED");
        emit Contribute(msg.sender, msg.value);
    }

    /**
     * @dev Investor claim tokens
     *
     * Check the phase is Open and investor has claimable tokens
     * Then transfer tokens to the user wallet using SpaceCoin transfer method
     *
     */
    function claimTokens() external onlyOpenPhase hasClaimableTokens {
        uint256 tokenToAssign = addressToTokenDistribute[msg.sender];
        addressToTokenDistribute[msg.sender] = 0;

        emit TokensClaimed(msg.sender, tokenToAssign);
        require(_token.transfer(msg.sender, tokenToAssign), "SPC_TRANSFER_FAILED");
    }

    /**
     * @dev Calculate how many tokens will be issued to the investor
     * with the current contribution
     *
     * @param contribution Ether sent by the user for the contribution
     *
     */
    function calcEligibleTokens(uint256 contribution) internal view returns (uint256) {
        return ((contribution * 10**_token.decimals()) * RATE) / 1 ether;
    }

    /// @dev Let the owner to advance ICO phases in Seed / General
    function phaseAdvance(IcoPhase expectedCurrent) external onlyOwner canAdvance {
        if (currentPhase != expectedCurrent) {
            revert InvalidPhase(uint8(currentPhase), uint8(expectedCurrent));
        }

        currentPhase = IcoPhase(uint8(expectedCurrent) + 1);

        emit PhaseAdvanced(uint8(currentPhase));
    }

    /**
     * @dev Manage pause state for ICO
     * action prevented if the new value is the same as the one stored
     * ie: paused = false, newValue = false -> reverted
     *
     * @param newValue Value passed by the owner
     *
     */
    function setPaused(bool newValue) external onlyOwner {
        if (paused == newValue) {
            revert MustHaveDifferentPauseState(paused ? "ICO_ALREADY_PAUSED" : "ICO_ALREADY_ACTIVE");
        }
        paused = newValue;
        emit Paused(paused);
    }

    /* made for frontend */
    function getOwner() external view returns (address) {
        return _owner;
    }

    /* ADDED FOR LP PROJECT */
    function withdraw(uint256 amount) external onlyOwner {
        if (amountRaised <= 0) revert AmountRaisedEqualZero();
        if (amount <= 0) revert InsufficientAmount();
        if (amount > address(this).balance) revert NotEnoughBalance();
        // amountRaised -= amounr; nope otherwise people can contribute again

        (bool sent, ) = treasury.call{value: amount}("");
        require(sent, "Failed to send Ether on withdraw");
    }

    event Contribute(address, uint256);
    event TokensClaimed(address, uint256);
    event PhaseAdvanced(uint8);
    event Paused(bool);

    error MustBeActive(string);
    error MustBeOwner(string);
    error MustBeAllowed(string, address);
    error MustBeUnderLimit(string, uint256, uint256);
    error MustBeGreaterThanZero(string);
    error MustHaveClaimableTokens(string, address);
    error MustHaveDifferentPauseState(string);
    error WrongPhase(string);
    error InvalidPhase(uint8, uint8);
    error AmountRaisedEqualZero();
    error NotEnoughBalance();
    error InsufficientAmount();
}
