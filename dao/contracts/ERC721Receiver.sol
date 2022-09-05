// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

contract ERC721Receiver is IERC721Receiver {
    ///@dev See {IERC721Receiver-onERC721Received}.
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
