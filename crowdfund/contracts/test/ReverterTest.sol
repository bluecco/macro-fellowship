//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "../Project.sol";
import "../ProjectFactory.sol";

contract ReverterTest {
    Project public p;
    ProjectFactory pf;

    function create(address _addr) external {
        pf = ProjectFactory(payable(_addr));
        p = pf.create("test", "TEST", 1 ether);
    }

    function withdrawFunds() public {
        p.withdrawFunds(0.5 ether);
    }

    function refund() public {
        p.refund();
    }

    function contribute() public payable {
        p.contribute{value: msg.value}();
    }

    fallback() external payable {
        require(false);
    }
}
