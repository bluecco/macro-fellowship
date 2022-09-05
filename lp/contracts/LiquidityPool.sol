// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./SpaceCoin.sol";
import "./libraries/Helpers.sol";

contract LiquidityPool is ERC20 {
    SpaceCoin public immutable spaceCoin;

    uint256 private ethReserve;
    uint256 private spcReserve;

    /* need a lock to avoid reentrancy, details on lock modifier */
    uint8 isUnlocked = 1;

    constructor(address _spaceCoin) ERC20("Ether-SpaceCoin Pair", "ETHSPCLP") {
        spaceCoin = SpaceCoin(_spaceCoin);
    }

    /**
     * @notice check if the function is locked
     *
     * @dev needed because actions are performed after .call function, not using checks-effect-interaction in swap function (and keep safe also mint/burn)
     * I believe this approach is more clear in this case compared to checks-effect-interactions while swapping
     */
    modifier lock() {
        if (isUnlocked == 2) {
            revert LiquidityPoolLocked();
        }
        isUnlocked = 2;
        _;
        isUnlocked = 1;
    }

    /**
     * @notice mint LP tokens to add liquidity to the pool
     *
     * @dev the function is payable in order to receive ETH directly
     *
     * @param to the address where the LP tokens will be sent
     *
     * @return amount of minted LP tokens
     */
    function mint(address to) external payable returns (uint256) {
        (uint256 _ethReserve, uint256 _spcReserve) = getReserves();
        (uint256 ethBalance, uint256 spcBalance) = getBalances();
        uint256 liquidity;
        uint256 _totalSupply = totalSupply();
        uint256 _spcIn = spcBalance - _spcReserve;
        uint256 _ethIn = ethBalance - _ethReserve;

        if (_totalSupply == 0) {
            liquidity = Helpers.sqrt(_spcIn * _ethIn);
        } else {
            liquidity = Helpers.min((_ethIn * _totalSupply) / _ethReserve, (_spcIn * _totalSupply) / _spcReserve);
        }

        if (liquidity <= 0) revert NoLiquidityProvided(to);

        _mint(to, liquidity);

        sync();

        emit Minted(msg.sender, _ethIn, _spcIn);

        return liquidity;
    }

    /**
     * @notice burn user's LP tokens and return ETH/SPC values
     *
     * @param liquidity LP tokens to burn
     * @param to the address where ETH/SPC will be sent
     *
     * @return amount of minted LP tokens
     */
    function burn(uint256 liquidity, address to) external lock returns (uint256, uint256) {
        (uint256 _ethReserve, uint256 _spcReserve) = getReserves();
        uint256 _totalSupply = totalSupply();

        if (_totalSupply == 0) revert NoLiquidityInPool();

        uint256 ethOut = (liquidity * _ethReserve) / _totalSupply;
        uint256 spcOut = (liquidity * _spcReserve) / _totalSupply;

        if (ethOut <= 0 || spcOut <= 0) revert InsuffiecientLiquidityBurned(ethOut, spcOut);

        _burn(address(this), liquidity);

        spaceCoin.transfer(to, spcOut);
        (bool success, bytes memory data) = to.call{value: ethOut}("");
        if (!success) {
            if (data.length > 0) {
                // "Catch" the revert reason using memory via assembly
                assembly {
                    let data_size := mload(data)
                    revert(add(32, data), data_size)
                }
            } else {
                revert BurnTransferEthToError(to);
            }
        }

        sync();

        emit Burned(msg.sender, ethOut, spcOut);

        return (ethOut, spcOut);
    }

    /**
     *
     * @notice receives an amount in (ETH or SPC) and return the amount of the opposite token.
     *
     * @dev Function is payable because it could receive ETH
     * Fee will be deposited in the pool, amount less fee will be used to perfrom the amountOut calculation.
     * If tax is active on spc, need to calc the value without the tax that will be sent to the liquidity pool.
     *
     * @param to address to send the swapped token
     *
     */
    function swap(address to) external payable lock returns (uint256) {
        (uint256 _ethReserve, uint256 _spcReserve) = getReserves();
        (uint256 ethBalance, uint256 spcBalance) = getBalances();
        uint256 _spcIn = spcBalance - _spcReserve;
        uint256 _ethIn = ethBalance - _ethReserve;

        uint256 amountOut;

        if (_ethIn <= 0 && _spcIn <= 0) revert InsufficientInAmount(_ethIn, _spcIn);
        if (_ethIn > 0 && _spcIn > 0) revert OnlyOneTokenInAllowed(_ethIn, _spcIn);

        if (_ethReserve <= 0 || _spcReserve <= 0) {
            revert ReservesAmountInvalid(_ethReserve, _spcReserve);
        }

        if (_ethIn > 0) {
            amountOut = getAmountReceived(_ethIn, _ethReserve, _spcReserve);
            if (amountOut >= _spcReserve) revert InsufficientLiquidity(amountOut, _spcReserve);
            spaceCoin.transfer(to, amountOut);
        } else {
            amountOut = getAmountReceived(_spcIn, _spcReserve, _ethReserve);
            if (amountOut >= _ethReserve) revert InsufficientLiquidity(amountOut, _ethReserve);
            (bool success, bytes memory data) = to.call{value: amountOut}("");
            if (!success) {
                if (data.length > 0) {
                    // "Catch" the revert reason using memory via assembly
                    assembly {
                        let data_size := mload(data)
                        revert(add(32, data), data_size)
                    }
                } else {
                    revert SwapTransferEthToError(to, amountOut);
                }
            }
        }

        /*
         * Ho to get to (ethBalance * 100) - amountEthIn, explained by AbhiG on discord
         * balance0Adjusted = _reserve0 + .997 * amount0In =>
         * balance0Adjusted = balance0 - amount0In + .997 * amount0In =>
         * balance0Adjusted = balance0 - .003 * amount0In
         *
         * replace 997 with 999 in our case and remove mul(3) since  (1%)
         *
         */
        (ethBalance, spcBalance) = getBalances();

        uint256 balanceETHWithFee = (ethBalance * 100) - _ethIn;
        uint256 balanceSPCWithFee = (spcBalance * 100) - _spcIn;

        if ((balanceETHWithFee * balanceSPCWithFee) < (ethReserve * spcReserve) * 100**2)
            revert WrongKValueAfterSwap(balanceETHWithFee * balanceSPCWithFee, ethReserve * spcReserve * 100**2);

        sync();

        emit Swapped(
            msg.sender,
            _ethIn > 0 ? "ETH_FOR_SPC" : "SPC_FOR_ETH",
            _ethIn,
            _ethIn > 0 ? 0 : amountOut,
            _spcIn,
            _spcIn > 0 ? 0 : amountOut
        );
        return amountOut;
    }

    /**
     * @return liquidity pool's balances
     */
    function getBalances() internal view returns (uint256, uint256) {
        return (address(this).balance, spaceCoin.balanceOf(address(this)));
    }

    /**
     * @return liquidity pool's reserves
     */
    function getReserves() public view returns (uint256, uint256) {
        return (ethReserve, spcReserve);
    }

    /**
     * @notice calculate tokens received in a swap
     *
     * @param amountIn amount to deposit
     * @param reserveIn reserve of the tokens to deposit
     * @param reserveOut reserve of the tokens to receive
     *
     * @return amount token that will be received
     *
     */
    function getAmountReceived(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256) {
        uint256 amountInWithFee = amountIn * 99; // 1% fee
        return (amountInWithFee * reserveOut) / ((reserveIn * 100) + amountInWithFee);
    }

    function sync() public {
        spcReserve = IERC20(spaceCoin).balanceOf(address(this));
        ethReserve = address(this).balance;
    }

    event Minted(address indexed sender, uint256 ethIn, uint256 spcIn);
    event Burned(address indexed sender, uint256 ethOut, uint256 spcOut);
    event Swapped(
        address indexed sender,
        string direction,
        uint256 ethIn,
        uint256 ethOut,
        uint256 spcIn,
        uint256 spcOut
    );

    error LiquidityPoolLocked();
    error NoLiquidityInPool();
    error WrongDepositInput();
    error NoLiquidityProvided(address);
    error InsuffiecientLiquidityBurned(uint256 _ethOut, uint256 _spcOut);
    error BurnTransferEthToError(address);
    error InsufficientInAmount(uint256 _ethIn, uint256 _spcIn);
    error InsufficientLiquidity(uint256 _amountOut, uint256 _reserve);
    error WrongKValueAfterSwap(uint256, uint256);
    error SwapTransferEthToError(address, uint256 _amountOut);
    error ReservesAmountInvalid(uint256 _ethReserve, uint256 _spcReserve);
    error OnlyOneTokenInAllowed(uint256 _ethIn, uint256 _spcIn);
}
