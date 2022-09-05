// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Import this file to use console.log
import "hardhat/console.sol";
import "../INftMarketplace.sol";

contract NftMarketplace is INftMarketplace {
    mapping(uint256 => uint256) public prices;
    mapping(uint256 => address) public nftOwners;

    constructor() {
        prices[0] = 1 ether;
        prices[1] = 1.5 ether;
        prices[2] = 0.5 ether;
        prices[3] = 4 ether;
        prices[4] = 1000 ether;
        prices[5] = 0;
    }

    function getPrice(address nftContract, uint256 nftId)
        external
        view
        returns (uint256 price)
    {
        return prices[nftId];
    }

    function buy(address nftContract, uint256 nftId)
        external
        payable
        returns (bool success)
    {
        if (nftId == 5) {
            // used for test purposes on verifyResult
            return false;
        }

        if (nftId > 5) {
            // used for test purposes on verifyResult
            revert();
        }

        nftOwners[nftId] = msg.sender;
        return true;
    }
}
