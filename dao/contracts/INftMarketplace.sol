// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface INftMarketplace {
    function getPrice(address nftContract, uint256 nftId)
        external
        returns (uint256 price);

    function buy(address nftContract, uint256 nftId)
        external
        payable
        returns (bool success);
}
