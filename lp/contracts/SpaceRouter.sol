// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./SpaceCoin.sol";
import "./LiquidityPool.sol";

contract SpaceRouter {
    address immutable owner;
    LiquidityPool immutable liquidityPool;
    SpaceCoin immutable spaceCoin;

    constructor(address _liquidityPool, address _spaceCoin) {
        owner = msg.sender;
        liquidityPool = LiquidityPool(_liquidityPool);
        spaceCoin = SpaceCoin(_spaceCoin);
    }

    /**
     * @notice allow user to deposit ETH and SPC to receive LP tokens
     *
     * @dev the function is payable in order to receive ETH directly. SPC increaseAllowance is called on client
     *
     * @param spcAmount amount of SPC to deposit
     *
     * @return amount of ETH and SPC deposited, liquidity received
     */
    function deposit(uint256 spcAmount)
        external
        payable
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        uint256 _amountEth = msg.value;
        uint256 _amountSpc = spcAmount;

        spaceCoin.transferFrom(msg.sender, address(liquidityPool), _amountSpc);
        uint256 liquidity = liquidityPool.mint{value: _amountEth}(msg.sender);
        return (_amountEth, _amountSpc, liquidity);
    }

    /**
     * @notice allow user to withdraw a certain amount of LP tokens
     *
     * @dev LP tokens increaseAllowance is called on client
     *
     * @param liquidity LP tokens amount to withdraw
     *
     * @return amount of ETH and SPC received
     */
    function withdraw(uint256 liquidity) external returns (uint256, uint256) {
        liquidityPool.transferFrom(msg.sender, address(liquidityPool), liquidity);
        (uint256 eth, uint256 spc) = liquidityPool.burn(liquidity, msg.sender);
        return (eth, spc);
    }

    /**
     * @notice allow user to swap ETH for SPC
     *
     * @dev the function is payable in order to receive ETH directly
     *
     * @param minSpcOut amount of SPC considering slippage
     *
     * @return amount of ETH deposited and amount of SPC received
     */
    function swapEthForSpc(uint256 minSpcOut) external payable returns (uint256, uint256) {
        uint256 amountEthIn = msg.value;
        uint256 spcOut = liquidityPool.swap{value: amountEthIn}(msg.sender);

        if (spcOut < minSpcOut) revert InsufficientSPCAmount(spcOut, minSpcOut);

        return (amountEthIn, spcOut);
    }

    /**
     * @notice allow user to swap ETH for SPC
     *
     * @dev SPC increaseAllowance is called on client.
     *
     * @param amountIn amount SPC to deposit
     * @param minEthOut amount of ETH considering slippage
     *
     * @return amount of ETH received and amount of SPC deposited
     */
    function swapSpcForEth(uint256 amountIn, uint256 minEthOut) external returns (uint256, uint256) {
        uint256 amountSpcIn = amountIn;
        spaceCoin.transferFrom(msg.sender, address(liquidityPool), amountSpcIn);
        uint256 ethOut = liquidityPool.swap(msg.sender);

        if (ethOut < minEthOut) revert InsufficientETHAmount(ethOut, minEthOut);

        return (ethOut, amountSpcIn);
    }

    /**
     * @notice calculate tokens received in a swap
     *
     * @dev used by a client to show the amount received by the user. Only consider LP fee (not SPC tax)
     *
     * @param amountIn amount to deposit
     * @param reserveIn reserve of the tokens to deposit
     * @param reserveOut reserve of the tokens to receive
     *
     * @return amount token that will be received
     */
    function getAmountReceived(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256) {
        if (amountIn <= 0) revert InputAmountInvalid();
        if (reserveIn <= 0 || reserveOut <= 0) revert ReservesAmountInvalid(reserveIn, reserveOut);
        uint256 amountInWithFee = amountIn * 99; // 1% fee
        return (amountInWithFee * reserveOut) / ((reserveIn * 100) + amountInWithFee);
    }

    /**
     * @notice calculate the optimal amount of a token when depositing liquidity
     *
     * @param amountA amount of the token used to perform the calc
     * @param reserveA reserve of the token used to perform the calc
     * @param reserveB reserve of the other token of the pair
     *
     * @return optimal amount of token to deposit
     */
    function calcOptimalAmount(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) public pure returns (uint256) {
        if (amountA <= 0) revert InputAmountInvalid();
        if (reserveA <= 0 || reserveB <= 0) revert ReservesAmountInvalid(reserveA, reserveB);
        return (amountA * reserveB) / reserveA;
    }

    error InputAmountInvalid();
    error ReservesAmountInvalid(uint256, uint256);
    error InsufficientETHAmount(uint256, uint256);
    error InsufficientSPCAmount(uint256, uint256);
    error InsufficientAmount(uint256, uint256, uint256, uint256);
    error WrongEthAmount(uint256, uint256);
    error WrongSpcAmount(uint256, uint256);
    error EthAmounLowerThanMin(uint256, uint256);
    error SpcAmounLowerThanMin(uint256, uint256);
}
