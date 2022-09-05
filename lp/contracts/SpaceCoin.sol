// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SpaceCoin is ERC20 {
    // used only within this contract
    uint256 private constant SPC_TOTAL_SUPPLY = 500_000;

    // public since it's used in frontend too
    uint256 public constant ICO_SUPPLY = 150_000;

    address private immutable _owner;
    address payable public treasuryWallet;

    bool public isTaxActive;

    error MustBeOwner(string);

    /// @param _treasuryWallet Treasury wallet address
    constructor(address _treasuryWallet) ERC20("SpaceCoin", "SPC") {
        require(_treasuryWallet != address(0), "Invalid address");

        _owner = msg.sender;
        treasuryWallet = payable(_treasuryWallet);

        // mint tokens that are not part of ICO to treasury address
        _mint(treasuryWallet, (SPC_TOTAL_SUPPLY - ICO_SUPPLY) * (10**uint256(decimals())));

        // mint tokens that are part of ICO to the deployer
        // thehy will be transfered, during deploy, from deployer address to ICO contract
        // https://ethereum.stackexchange.com/a/97745
        _mint(msg.sender, ICO_SUPPLY * (10**uint256(decimals())));
    }

    /// @dev check sender is the owner
    modifier onlyOwner() {
        if (_owner != msg.sender) {
            revert MustBeOwner("NOT_OWNER");
        }
        _;
    }

    /**
     * @dev See {ERC20-transfer}.
     *
     * @param to Address where tokens will be moved
     * @param amount Amount to transfer
     */
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (isTaxActive) {
            uint256 taxFee = (amount * 200) / 10000;
            amount -= taxFee;
            super._transfer(from, treasuryWallet, taxFee);
        }
        super._transfer(from, to, amount);
    }

    /// @dev toggle tax flag on/off
    function toggleTax() external onlyOwner {
        isTaxActive = !isTaxActive;
    }
}
