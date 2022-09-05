https://github.com/0xMacro/student.bluecco/tree/efc777899ae6baf30f4f31fe46b8c47402ba694e/lp

Audited By: Agus

# General Comments

Great work Alessandro, your code is clear simple, well tested and functional. Natspec and general comments over your code are a great practice and simplified this audit execution (AKA my job). I really enjoyed going through your project and the practicality of the implementations. There is one issue with the pool `mint` and `swap` functions that could break it though, also as we discussed there is an issue with enforcing the ratio in certain scenarios that could be quite common, even if the idea was users get the exact proper lp tokens from their contributions, this will make the transaction fail.  

Considering that you made it without almost seeing uniswap this is a really great last project! Congrats!

# Design Exercise

I appreciate you took the time to make a few options to consider, great answers! I think rewarding on mint could be tricky, since anyone could just mint and burn to get these extra tokens, so be careful with rewarding actions that only would cost the gas execution. One other idea could be implementing a staking mechanism to encourage lp providers to stake their lp tokens in other contract and provide rewards. Including some utility to this rewards will incentivize even more lp providers to keep their liquidity share in the pool.

# Issues

## **[H-1]** Incorrect liquidity minting and reserve update in pool

On `LiquidityPool.sol`, `mint` function takes a `spcIn` parameter. This amount is used even if the sender never deposited any SPC. This allows anyone to deposit any amount of ETH and zero SPC, and still receive LP as if they had deposited an equivalent amount of SPC. In addition to the "free" lp tokens, on line 77 `LiquidityPool.sol` has the following code:

```solidity
ethReserve += _ethIn;
spcReserve += _spcIn;
```

The `spcReserve` will be updated with non existent liquidity of SpaceCoin tokens therefore `swap` and `burn` functions will be open for exploits. One example of this would be draining the SpaceCoin balance by acquiring lp tokens just with ETH and then burning them to get back the ETH and SpaceCoin tokens. 

## **[H-2]** Incorrect swap exchange in pool

On `LiquidityPool.sol`, `swap` function takes a `spcIn` parameter. This amount is used even if the sender never deposited any SPC. This allows anyone to deposit any amount of ETH and zero SPC, and still receive LP as if they had deposited an equivalent amount of SPC. This allows attackers to drain the ETH of the pool without adding any actual SPC tokens.

You should always check the actual balance of assets is in the contract.

## **[M-1]** Ratio checks on pool make it difficult to add liquidity

On line 60, `LiquidityPool.sol` has the following code:

```solidity
if (_spcReserve != 0 && _ethReserve != 0 && _spcIn != (_ethIn * _spcReserve) / _ethReserve)
    revert LiquidityWrongRatio(_ethIn, _spcIn);
```
There are a few problems with this approach:
- By enforcing the ratio with `_spcIn != (_ethIn * _spcReserve) / _ethReserve` math rounding errors with some `spcIn` and `ethIn` calculations in router will make the transaction fail.
- Even if the values calculated in the router are correct, by the time the transaction it's mined, the ratio of the reserves will most probably have changed. One `swap` before the call is all it's required to make it fail. 

An example of this could be using the current reserve values and trying to add liquidity. Using solidity-shell to calculate `_ethIn` and `_spcIn` with current reserves will differ because of solidity rounding:

| Current values of reserve: | wei | ether |
|-|-|-|
| SpaceCoin: | 4764173415912339212 | 4,764173415912339212 |
| Eth: | 1050000000000000002 | 1,050000000000000002 |


If we calculate the amount of `ethIn` with `0.23` SpaceCoin tokens we can see `ethIn` should be `50690850000000000` (0.5069085 ether)
```solidity-shell
 »  uint(230000000000000000 * 1050000000000000002)/ 4764173415912339212
50690850000000000
```

Then if we try the other way around to get `spcIn` with the result of the previous result we can see it should be `229999999999999999` differing from the `230000000000000000` used before.

```solidity-shell
 »  uint(50690850000000000 * 4764173415912339212) / 1050000000000000002
229999999999999999
```

Consider using the minimum of the two ratios without reverting if the ratio changes, one solution if the idea is the user not to loose funds, is to add a slippage to the mint function so users can choose to revert the transaction if the ratio changes too much.

## **[Extra Feature-1]** Lock modifier in mint is not necessary 

On `LiquidityPool.sol`, `mint` function has reentrancy protection but this function doesn't make any external calls and no attack vector if an user reenters this function through the other calls in `swap` or `burn`.

## **[Q-1]** Swap event doesn't report swap direction

As we can see in Swapped event declaration in `LiquidityPool.sol`, line 247:

```solidity
event Swapped(address indexed sender, uint256, uint256);
```

This event is used in both spc for eth and eth for spc swaps, and outputs the corresponding amounts but there is no description in the event parameters and no info about the direction of the swap. It'd be very helpful to know what assets were swapped, one way of doing it would be including all parameters in the event such as `spcIn`, `ethIn`, `spcOut` and `ethOut` and filling with zero depending on the swap.


## **[Q-2]** Update reserves with balance in all functions

In the LiquidityPool contract, `swap` function updates the reserves storage with the balances of the contract after doing all checks, different from that in `mint` and `burn` functions, reserves are updated with the function parameters. This could create an offset from the current values if assets are sent directly to the contract, it's not an issue (leaving out H-1) but updating reserves with balances is a consistent way to use these assets inside the contract.

## **[Q-3]** Ratio of ETH and SPC amounts is not checked in Router  

The main router functionality is to have proper checks to interact with before calling pool functions, functions `deposit` doesn't include any ratio check. Even if the function `calcOptimalAmount` is called in the front end before `deposit`, the values from the reserve could change from one call to the other and therefore the transaction would revert. Consider doing these checks inside router function. 

# Nitpicks

* Initialize variables to default values is not necessary. E.g. `uint256 amountOut = 0;` 
* Having parameter names in custom errors can be really helpful. E.g. `error ReservesAmountInvalid(uint256 ethReserve, uint256 spcReserve);`

# Score

| Reason | Score |
|-|-|
| Late                       | - |
| Unfinished features        | - |
| Extra features             | 1 |
| Vulnerability              | 8 |
| Unanswered design exercise | - |
| Insufficient tests         | - |
| Technical mistake          | - |

Total: 9

Good job!
