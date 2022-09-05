// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./SpaceCoin.sol";
import "hardhat/console.sol";

contract SpaceCoinIco {
    uint256 public constant GOAL = 30_000 ether;
    uint256 public constant SEED_PHASE_GOAL = 15_000 ether;
    uint256 private constant SEED_PHASE_PERSONAL_LIMIT = 1500 ether;
    uint256 private constant GENERAL_PHASE_PERSONAL_LIMIT = 1000 ether;
    uint256 private constant RATE = 5;
    uint256 public amountRaised;

    address public immutable owner;
    address public immutable treasury;

    mapping(address => uint256) public addressToContribution;
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
     * @param _treasury Address of treasury
     */
    constructor(
        address _owner,
        address _tokenAddress,
        address _treasury
    ) {
        owner = _owner;
        treasury = _treasury;
        _token = SpaceCoin(_tokenAddress);
    }

    function addInvestor(address investor) public onlyOwner {
        allowlistPrivateInvestors[investor] = true;
    }

    /// @dev check sender is the owner
    modifier onlyOwner() {
        if (owner != msg.sender) {
            revert MustBeOwner("NOT_OWNER");
        }
        _;
    }

    /// @dev check if investor can contribute in Seed Phase
    modifier onlyIfAllowed() {
        if (
            currentPhase == IcoPhase.SEED &&
            !allowlistPrivateInvestors[msg.sender]
        ) {
            revert MustBeAllowed("NOT_ALLOWED", msg.sender);
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

        uint256 investorContribution = addressToContribution[msg.sender] +
            msg.value;
        uint256 totalContribution = amountRaised + msg.value;

        if (currentPhase == IcoPhase.SEED) {
            canContributeUnderLimit(
                investorContribution,
                SEED_PHASE_PERSONAL_LIMIT,
                "ABOVE_PERSONAL_LIMIT"
            );
            canContributeUnderLimit(
                totalContribution,
                SEED_PHASE_GOAL,
                "ABOVE_ICO_GOAL_LIMIT"
            );
        }

        if (currentPhase == IcoPhase.GENERAL) {
            canContributeUnderLimit(
                investorContribution,
                GENERAL_PHASE_PERSONAL_LIMIT,
                "ABOVE_PERSONAL_LIMIT"
            );
        }

        if (currentPhase != IcoPhase.SEED) {
            canContributeUnderLimit(
                totalContribution,
                GOAL,
                "ABOVE_ICO_GOAL_LIMIT"
            );
        }

        uint256 amount = msg.value;

        amountRaised += amount;
        addressToContribution[msg.sender] += amount;

        if (currentPhase == IcoPhase.OPEN) {
            claimTokens();
        }
        emit Contribute(msg.sender, msg.value);
    }

    /**
     * @dev Investor claim tokens
     *
     * Check the phase is Open and investor has claimable tokens
     * Then transfer tokens to the user wallet using SpaceCoin transfer method
     *
     */
    function claimTokens() public {
        if (currentPhase != IcoPhase.OPEN) revert WrongPhase("NOT_OPEN_PHASE");
        if (addressToContribution[msg.sender] == 0) {
            revert MustHaveClaimableTokens("NO_CLAIMABLE_TOKENS", msg.sender);
        }

        uint256 tokenToAssign = addressToContribution[msg.sender] * 5;
        addressToContribution[msg.sender] = 0;

        emit TokensClaimed(msg.sender, tokenToAssign);
        require(
            _token.transfer(msg.sender, tokenToAssign),
            "SPC_TRANSFER_FAILED"
        );
    }

    /// @dev Let the owner to advance ICO phases in Seed / General
    function phaseAdvance(IcoPhase expectedCurrent) external onlyOwner {
        if (currentPhase == IcoPhase.OPEN)
            revert WrongPhase("ALREADY_IN_OPEN_PHASE");
        if (currentPhase != expectedCurrent)
            revert InvalidPhase(currentPhase, expectedCurrent);

        currentPhase = IcoPhase(uint8(expectedCurrent) + 1);

        emit PhaseAdvanced(currentPhase);
    }

    /**
     * @dev Manage pause state for ICO
     */
    function togglePause() external onlyOwner {
        paused = !paused;
        emit Paused(paused);
    }

    event Contribute(address, uint256);
    event TokensClaimed(address, uint256);
    event PhaseAdvanced(IcoPhase);
    event Paused(bool);

    error MustBeActive(string);
    error MustBeOwner(string);
    error MustBeAllowed(string, address);
    error MustBeUnderLimit(string, uint256, uint256);
    error MustBeGreaterThanZero(string);
    error MustHaveClaimableTokens(string, address);
    error MustHaveDifferentPauseState(string);
    error WrongPhase(string);
    error InvalidPhase(IcoPhase, IcoPhase);
}
