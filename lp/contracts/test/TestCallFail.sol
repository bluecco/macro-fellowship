//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "../LiquidityPool.sol";

contract TestCallFail {
    LiquidityPool public p;

    constructor(address payable _addr) payable {
        p = LiquidityPool(payable(_addr));
    }

    receive() external payable {
        require(false);
    }

    function testCallBurnFail() external {
        p.burn(1 ether, address(this));
    }

    function testCallSwapFail() external {
        p.swap(address(this));
    }
}
