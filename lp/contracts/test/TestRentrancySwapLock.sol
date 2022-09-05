//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "../LiquidityPool.sol";

contract TestRentrancySwapLock {
    LiquidityPool public p;

    constructor(address payable _addr) payable {
        p = LiquidityPool(payable(_addr));
    }

    receive() external payable {
        if (address(this).balance >= 1) {
            p.swap(address(this));
        }
    }

    function testRentrancyLock() external {
        p.swap(address(this));
    }
}
