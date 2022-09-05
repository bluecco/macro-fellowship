//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "../LiquidityPool.sol";

contract TestRentrancyBurnLock {
    LiquidityPool public p;

    constructor(address payable _addr) payable {
        p = LiquidityPool(payable(_addr));
    }

    receive() external payable {
        if (address(this).balance >= 1) {
            p.burn(1, address(this));
        }
    }

    function testRentrancyLock() external {
        p.burn(1 ether, address(this));
    }
}
