# Summary

Overall, the implementation is sound! I only found one medium priority issue. All other code quality issues or low priority issues are close to nitpicky.

I did not review the frontend code, only the solidity contracts, the deploy script, and the tests.

## **[M-1]** `transferFrom` does not support tax.

Starting in line 53 for `SpaceCoin.sol`, the `transfer` function in `ERC20` is overwritten to include logic in charging a tax. However, the `transferFrom` function in `ERC20` is not overwritten, meaning a user can always use `transferFrom` instead of `transfer` to avoid the tax.

One alternative design is to overwrite the `_transfer` function in `ERC20` to include the tax logic, which is used by both `transfer` and `transferFrom` internally.

I believe this is a medium issue, rather than a high priority issue since it does not break core contract logic (of issuing an ICO), but does hinder fees from being transferred to the treasury.

## **[L-1]** Consider deploying the `SpaceCoin` contract from within the `SpaceCoinIco` contract.

Currently, if we look at `scripts/deploy.ts`, the deployment logic is to first deploy `SpaceCoin.sol` from a deployer address, then deploy the `SpaceCoinIco.sol` contract. This requires one additional `transfer` call on line 18 to move all of the deployer's `SpaceCoin` assets to the ICO contract.

A possible alternative is to deploy the `SpaceCoin` contract within the `SpaceCoinIco` contract (using the `new SpaceCoin(...)` syntax like we did with factories from Crowdfundr). This has two benefits: (1) deploying the ICO contract automatically deploys the token contract; (2) the `_owner` for the token contract is the ICO contract so no transfer is needed.

This is a low priority issue as the current design does not introduce any attack vulnerabilities.

## **[L-2]** Automatically transfer total amount of owned `SpaceCoins` in Open Phase.

On line 204, the user is automatically transferred `SpaceCoins` with respect to the contributions they made in the open phase.
If a user contributed before the open phase as well, they have to make an additional call to `claimTokens`, paying extra gas.
This may have been an intentional design choice but why not save the user some gas and in line 204, transfer not just the amount of `SpaceCoins` owed from the open phase contributions but from the user's total contributions? In other words, just call `claimTokens`?

## **[Q-1]** Consider fewer modifiers.

Given many of the modifiers are only used once, I think there is a possibility of combining several of the modifiers from lines 61 to 129 (including the `canContributeUnderLimit`) into a single function that decides if a contribution of X amount by address Y is allowed in the current phase. This is more a matter of opinion but I believe this would be easier to digest for a reader, and more clearly convey the relationship between the different modifier checks. A benefit of this design is that you would not need to double specify the `message` (once within the modifier errors, and once within the `contribute` function) on line 124 which is a bit inelegant.

## **[Q-2]** Save a variable on line 177.

Since we already define `investorContribution` and `totalContribution` at the top of the function, why not do the following:
```
amountRaised = totalContribution;
addressToCotnribution[msg.sender] = investorContribution;
```
which would save us from declaring `amount` on line 177.

## **[Q-3]** Remove argument from `setPaused`.

Consider implementing pausing behavior as a "toggle", meaning the owner calls a `togglePause` function to pause the ICO if it is currently unpaused, or to unpause the ICO if it is currently paused.
The current design requires an additional argument on line 260 as well as an additional check on line 262.

## Nitpicks
- Small type in comment on line 34 ("thehy" -> "they")
- Consider adding comments to line 14 and 16 in `SpaceCoin.sol` as they are important storage variables.
- Consider using `_owner` rather than `msg.sender` on line 36 of `SpaceCoin.sol` for better readability.
- Consider adding comments for the constants and storage variables in `SpaceCoinIco.sol`.
- In `SpaceCoinIco.sol`, consider making 148-175 `if`, `else if`, `else` statements (rather than a sequence of `if` statements) since all branches are exclusive.
