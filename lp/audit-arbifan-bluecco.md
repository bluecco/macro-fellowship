
## **[L-1]** No sync reserve public function, enabling malicious user to block swaps
On line 143, LiquidityPool.sol creates the swap function, and updates reserves directly in the function. As discussed in lecture, a malicious user can send a small amount of eth to block the swap function from being used. 

Consider: creating a public sync reserves function, which will enable any user to unblock the swap function. 


## **[Q-1]** No need to take into account spc tax when minting lp tokens

On line 63, LiquidityPool.sol has the following code:
            if (spaceCoin.isTaxActive()) {
            _spcIn -= ((_spcIn * 200) / 10_000);
        }

In the project spec, it specifies that we do not need to take into account the taxes for SPC for calculations. 

Consider: Removing checks for the tax toggle. 

## **[Q-2]** No checks in withdraw for minimum liquidity / slippage

In the withdraw function on line 53, there are no checks for the user to indicate the minimum eth or spc they expect back (not sure if this is required in the spec)


Consider: adding ethMin and spcMin as parameters for the withdraw functon and checking if the user is getting back an amount greater than the min.




## **[Q-3]** Removing magic numbers

On line 59 of LiquidityPool.sol, we have the following code:
    if (_totalSupply == 0 && (_ethIn * 5) != _spcIn) revert LiquidityWrongRatio(_ethIn, _spcIn);

On line 241 of LiquidityPool.sol, we have the following code:
    uint256 amountInWithFee = amountIn * 99;

Consider: making the fee and the ratio for eth to spc constant variables, which should make the code slightly more readable and easier to change across the codebase later on. 






