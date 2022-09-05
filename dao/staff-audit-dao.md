https://github.com/0xMacro/student.bluecco/tree/68a95407b618e1042e25bef4b3fa13821780d480/dao

Audited By: Diana

# General Comments

Awesome work! Great use of custom errors and great design decisions. Also, thank you for the detailed and organized tests!

# Design Exercise

Nice answer and nice pseudocode! I like your way of preventing transitive vote delegation and creating a Voter struct. 

Delegation chains could become really large and the only way to return votes, would require O(n) storage writes, where n is the length of the chain.

# Issues

## **[M-1]** NFT purchase price has no upper limit

When the DAO creates a proposal to purchase an NFT, the NFT seller could take advantage of that by raising the NFT price to some arbitrarily high amount.

Because the DAO does not check to make sure the price is reasonable, there is nothing stopping the DAO's funds from being drained by a malicious NFT seller.

Consider adding a `maxPrice` parameter to your `buyNftFromMarketplace` function, and check the price from the marketplace to ensure it's below the `maxPrice` before attempting to buy the NFT.

## **[L-1]** If a user checks the status of an uncreated proposal by calling `state()`, the `EXPIRED` state is returned

This return value could be misleading to off-chain observers. Consider creating another status such as `NOT_CREATED`

## **[Q-1]** Leaving hardhat/console.sol in production project

CollectorDao.sol imports hardhat/console.sol, which is a development package.

Consider removing hardhat/console.sol from your production code.

# Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | -     |
| Unfinished features        | -     |
| Extra features             | -     |
| Vulnerability              | 2     |
| Unanswered design exercise | -     |
| Insufficient tests         | -     |
| Technical mistake          | 1     |

Total: 3

Good job!
