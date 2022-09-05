https://github.com/0xMacro/student.bluecco/tree/eb8e7b15c43579782a887ea26e42b8335c36217e/interview-prep

Audited By: Brandon Junus

# Sudoku Challenge

Below you will find the staff audit for both of the interview question solutions you submitted. For the Sudoku Exchange problem, the audit will look a little different than you're used to. Instead of issues in the code you submitted, you will find several checklists of known vulnerabilities and known gas optimizations. We've added an `[x]` next to each item if you correctly identified that item in your submission, and a `[]` if not.

## General Comments

Great job on this project! You found most of the issues, and I'm confident that if you had to re-write these contracts, they would be pretty secure. Couple of quick notes:

1. A gentle heads up: the Sudoku Exchange problem is intentionally very difficult. Usually only 1 student manages to find enough vulnerabilities and gas optimizations to pass. Please, use this as a benchmark for how much you've learned in the last 6 weeks (only 6 weeks!). Even better, for those items you missed we hope you use it as a guide for the attack vectors to look out for on your next interview/audit.

2. As a note for reviewing this assignment, a lot of the issues you found are valid, but do not 100% translate to issues in the specs here. I did my best to mark the issues you found, but I think you would get the most value out of this assignment by reviewing the issues here.

## Issues

### High Severity Vulnerabilities

- [ ] `createReward()`'s `ERC20.transferFrom` call does not check the return value for success.

- [x] `createReward()` allows overwriting of existing challenge reward/token/solved.

- [x] Need to change the `.transfer` call to transfer to `msg.sender` so that it rewards the caller.

- [x] Need to change data type from `memory` to `storage` so that it changes the storage value of the `ChallengeReward`.

- [ ] `claimReward` can be front-run. `SudokuExchange` needs to change the `claimReward` logic to use a 2-stage commit-reveal process where the first transaction commits `keccak256(msg.sender + random_salt)`, and then, after some number of a blocks, in a second transaction the actual solution is provided. The `msg.sender + random_salt` hash ensures that the second transaction cannot be front-run.

- [x] Can be double-claimed. Need to check that it's not solved (or remove it from mapping).

- [x] `claimReward` is vulnerable to a reentrancy attack. (It would not be if it followed checks-effects-interactions.)

### Low Severity Vulnerabilities

- [ ] `claimReward`'s `ERC20.transfer` call does not check the return value for success.

- [x] `createReward()` allows creating an already solved challenge (`solved=true`), locking tokens.

- [ ] The `challenge` argument in `claimReward` is controlled by the user, so they could pass in a contract address with a `validate` function that always returns `true`.

- [ ] `createReward` does not handle feeOnTransfer tokens, because it assumes the amount sent in `transferFrom` is the amount received by the SudokuExchange.

### Gas Optimizations

- [ ] Turn solc gas optimizations on.
- [x] Gas savings from shorter error strings or Solidity Custom Errors.
- [ ] Do not create new contract with every challenge, instead store within `Challenge` struct on `SudokuExchange`.
- [ ] Only store hash of challenge and verify the hashed input challenge matches (similar to the implementatio [here](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/Governor.sol#L256))
- [ ] Eliminate duplicate information from `ChallengeReward` struct. The `challenge` struct member on line 20 is identical to the key of `rewardChallenges` on line 30. Consider removing the `challenge` struct member.
- [ ] Remove a memory variable allocation by getting rid of `isCorrect` function variable in `claimReward`. It can be passed directly to the `require` on the next line.

### Code Quality Issues

- [ ] There are no tests!
- [ ] The documet for comments, and add more variable, function, and contract comments.
- [ ] Explicitly markntation is sparse. Consider using the NatSpec forma the visibility of contract fields like `rewardChallenges` to be `public`.
- [ ] Add events to signify changes in the contract state.
- [x] Mark `createReward` and `validate` as external

## Score

1. You must find all but 1 of the High and Medium severity vulnerabilities in order to pass this interview.
2. You must have at least 3 of the Gas Optimizations to pass this interview.

INTERVIEW_RESULT
Interview failed. :slightly_frowning_face

# Signature MerkleDrop

## General Comments

Great job on this assignment! Overall, I'm confident that you understand merkle trees and how they could be used to airdrop.

## Issues

## **[H-1]** Does not check "alreadyClaimed"

Both signatureClaim and merkleClaim don't check if signer already claimed, meaning that the signer can claim multiple times.

Consider adding a check at the beginning of each function to make sure the the claimer hasn't already claimed:

```solidity
require(!alreadyClaimed[_to], "ALREADY_CLAIMED");
```

## **[L-1]** `signatureClaim` verifies signature against `_to`, when it should check `msg.sender`

In `signatureClaim` the address checked and then updated in the `alreadyClaimed` mapping is `_to` but it should be `msg.sender`. `msg.sender` is the address claiming tokens, `_to` is just the address the claimer wants to the tokens to be held in. Similarly, the address checked in the signature should be `msg.sender`. This is a Low Vulnerability because it implies that someone other than the `msg.sender` can submit a signature to claim the MACRO token, and since the signatures are held in some offchain database, it’s possible for those signatures to be obtained by a single user who then causes all the tokens to be claimed. The actual `_to` recipients may not want this, for example for tax purposes (an honest claimer could have waited until the next tax year to claim their token, and pay their capital gains tax).

## **[Q-1]** Events are not implemented

Though they are not an explicit requirement in the spec, it is a good practice to include events in your contract. Without them there is no easy way to track the history of the projects. In addition, they're useful for front end applications interacting with your contracts if you eventually implement them. In this case, contribution, refund, withdrawal, reaching the funding goal and project failure are all worthy of an event.

Consider adding events to your contracts.

## Score

| Reason                     | Score |
| -------------------------- | ----- |
| Late                       | -     |
| Unfinished features        | -     |
| Extra features             | -     |
| Vulnerability              | 4     |
| Unanswered design exercise | -     |
| Insufficient tests         | -     |
| Technical mistake          | -     |

Total: 4

Great job!
