
https://github.com/0xMacro/student.bluecco/tree/ae1c3145dd0bb420f0f0fac6823dee0cfaf34d11/ico

Audited By: Tom


# General Comments
Great solution! Clean and easy to read code. Your test coverage is very good and I really liked the fact that you used custom errors to save gas costs.  


# Design Exercise
Wow!!! This is quite a comprehensive answer to the design exercise. I can see that you put a lot of thoughts and effort into this and you came up with two different but great solutions. I especially liked your 1st approach, where the vesting logic is implemented in a separate contract. Similar approach is done by OpenZeppelin in the VestingWallet contract (see [here](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.4.1/contracts/finance/VestingWallet.sol)), where tokens are released based on defined vesting schedule. Very well done and props for that!



# Issues

**[M-1]** Transfer tax can be avoided.

The tax deduction is performed in an override of the `transfer()` function, but this will not catch all transfers. ERC-20's `transferFrom()` can still be used to transfer tokens and avoid the tax logic. Putting the same logic into the `_transfer(address,address,uint)` function would catch all transfers as the inherited ERC20 implementation always uses this internally.

Consider overriding the `_transfer()` function, which is called from both of ERC-20's `transfer()` and `transferFrom()`, to implement your tax functionality. Then, at the end of your overridden `_transfer`, use `super._transfer` to execute the parent contract's transfer functionality.


**[L-1]** Dangerous Phase Transitions

If the `phaseAdvance` function is called twice, a phase can accidentally be skipped. There are a few situations where this might occur:

1. Front-end client code malfunction calling the function twice.
2. Human error double-clicking a button on the interface on accident.
3. Repeat invocations with intent - Uncertainty around whether or not a 
transaction went through, or having a delay before a transaction processes, are common occurrences on Ethereum today.

Phase transitions are especially problematic, because once the ICO has advanced to the next phase there is no going back. Compare this to the toggle tax functionality, where it is easy for the owner to fix.

Consider refactoring this function by adding an input parameter that specifies either the expected current phase, or the expected phase to transition to.


**[Q-1]** Some modifiers used only once

`hasClaimableTokens`, `onlyOpenPhase`, and `canAdvance` modifiers are only used once in your code. 
Modifiers, however, are often most useful (and save gas) when they apply to more than one function. 
Consider using modifiers when they can apply to two or more functions, and including other gate logic in line.


**[Q-2]** Unnecessary `payable` keyword

In the `SpaceCoin.sol` contract, the variable `treasuryWallet` is declared with the `payable` keyword, but `payable` is not needed in this case. 

**[Q-3]** Unnecessary mapping

In the `SpaceCoinIco.sol` contract, the mapping `addressToTokenDistribute` could be easily avoided as the actual amount of SPC tokens to distribute can be calculated from `addressToContribution` mapping. Keep in mind that storage variables in general use quite a lot of gas and thus should be used economically. 

**[Q-4]** Mint tokens directly to ICO contract

In the constructor of `SpaceCoin.sol` contract, you initially mint the ICO supply to the owner of the contract. As described by you in the comments, the tokens are then transfered to the ICO contract during deployment. Better approach would be to mint the tokens directly to the address of the ICO contract and not rely on the correct deployment procedure. 

# Nitpicks
- For readability, consider to use `_` seperator for bigger numbers, e.g.: `150_000`
- Use `immutable` keyword to save gas costs for variables only initialized once in the constructor (e.g. for `_token` variable in `SpaceCoinIco.sol`).



# Score

| Reason | Score |
|-|-|
| Late                       | - |
| Unfinished features        | - |
| Extra features             | - |
| Vulnerability              | 3 |
| Unanswered design exercise | - |
| Insufficient tests         | - |
| Technical mistake          | - |

Total: 3

Good job!
