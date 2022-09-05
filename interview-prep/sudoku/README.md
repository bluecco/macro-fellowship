## **[H-1]** claimReward doesn't check if challenge is solved, if has a reward and doesn't update the reward property

SudokuExchange.sol at line 47 to 60

```solidity
function claimReward(SudokuChallenge challenge, uint8[81] calldata solution) public {
    // does this challenge even have a reward for it?
    require(address(rewardChallenges[address(challenge)].token) != address(0x0), "Sudoku challenge does not exist at this address");

    // now try to solve it
    bool isCorrect = challenge.validate(solution);

    require(isCorrect, "the solution is not correct");

    // they solved the Sudoku challenge! pay them and then mark the challenge as solved
    ChallengeReward memory challengeReward = rewardChallenges[address(challenge)];
    challengeReward.token.transfer(address(this), challengeReward.reward);
    challengeReward.solved = true;
}
```

Contract is not checking if the challenge has a reward and if it's already solved.
Contract doesn't set reward to 0 after the challenge is solved.
Along with missing checks at the beginning, a user could continue to submit the solution and claim reward.

Consider adding the check that reward is greater than 0, it's not solved and update `reward` field of `ChallengeReward` to 0 (see point `H-2`)

## **[H-2]** Reentrancy - cannot know what token.tranfer does

SudokuExchange.sol
possible reentrancy on token tranfer (since we don't know the implementation, it could make external calls)

```solidity
function claimReward(SudokuChallenge challenge, uint8[81] calldata solution) public {
        // does this challenge even have a reward for it?
        require(address(rewardChallenges[address(challenge)].token) != address(0x0), "Sudoku challenge does not exist at this address");

        // now try to solve it
        bool isCorrect = challenge.validate(solution);

        require(isCorrect, "the solution is not correct");

        // they solved the Sudoku challenge! pay them and then mark the challenge as solved
        ChallengeReward memory challengeReward = rewardChallenges[address(challenge)];
        challengeReward.token.transfer(address(this), challengeReward.reward);
        challengeReward.solved = true;
    }
```

Consider use C-E-I or adding a reentrancy guard

## **[H-3]** Reward never sent to user but locked in contract

SudokuExchange.sol at line 58

```solidity
challengeReward.token.transfer(address(this), challengeReward.reward);
```

Change address(this) with `msg.sender`

## **[M-1]** Storage never updated

SodukuExchange.sol at line 57

```solidity
ChallengeReward memory challengeReward = rewardChallenges[address(challenge)];
```

The updated challenge is in memory and not updating the storage.

## **[M-2]** Prevent creator to solve the puzzle

Anyone, included the creator, can solve the puzzle.
Prevent creators to claim rewards on their own challenges in function `claimReward`

Consider adding `address creator` in SudokuChallenge.sol or in `ChallengeReward` struct and assign the msg.sender that will create the challenge
in order to be used in the check

## **[M-3]** Cannot prevent multiple challenges that are equals

There is no check in both SudokuExchange or SudokuChallenge that a challenge already exists.
So there could be multiple challenges that are the same.

Someone could just spot them and claim multiple rewards with the same solution.

## **[M-4]** No checks on challengeReward on createReward

SudokuExchange.sol lines 36 to 44

```solidity
 function createReward(ChallengeReward memory challengeReward) public {
        // first transfer in the user's token approved in a previous transaction
        challengeReward.token.transferFrom(msg.sender, address(this), challengeReward.reward);

        // now store the reward so future callers of SudokuExchange.claimReward can solve the challenge
        // and claim the reward
        rewardChallenges[address(challengeReward.challenge)] = challengeReward;

    }
```

The challenge in the storage could be empty since there is no check that the challenge actually exists and neither the token.

Consider check that token and challenge addresses are not 0x0.

Check **[L-2]** for a refactor that could improve this

## **[L-1]** Wrong check on contract address existance

SodukuExchange.sol at line 49

```solidity
require(address(rewardChallenges[address(challenge)].token) != address(0x0), "Sudoku challenge does not exist at this address");
```

Wrong check made, it should be

```solidity
require(address(challenge) != address(0x0), "Sudoku challenge does not exist at this address");
```

In function `claimReward`

## **[L-2]** createReward should be a factory for SudokuChallenge

function createReward should be renamed createChallenge and be a factory used to create SudokuChallenge contracts
After the challenge is created the storage variable `rewardChallenges` should be updated with all the values needed.
Lastly, it should transfer the tokens to SudokuExchange contract

```solidity
function createReward(ChallengeReward memory challengeReward) public {
    // first transfer in the user's token approved in a previous transaction
    challengeReward.token.transferFrom(msg.sender, address(this), challengeReward.reward);

    // now store the reward so future callers of SudokuExchange.claimReward can solve the challenge
    // and claim the reward
    rewardChallenges[address(challengeReward.challenge)] = challengeReward;

}
```

Consider pass the reward, token and challenge as params for the funcion.
Use them to create a new contract of SudokuChallenge and then add them in the storage variable `rewardChallenges`.

## **[Q-1]** Remove import of console.sol

SudokuExchange.sol and SudokuChallenge.sol import hardhat/console.sol, which is a development package.
Consider removing hardhat/console.sol from your production code.

## **[Q-2]** Remove constructor visibility

Remove visibility on constructor in both of contracts since it's not needed with the current solidity version

## **[Q-3]** Remove constructor in SudokuExchage

SudokuExchage.sol at line 32-33

```solidity
constructor() public {
}
```

Constructor is not used, can be removed

### Gas Optimizations

- createReward and claimReward in `SudokuExchange.sol` should be external to save gas

- validate in `SudokuChallenge.sol` should be external to save gas

- Use custom errors instead of require to save gas and have better formatted errors (also querables)

- in createReward function, use calldata instead of memory for `challengeReward`

```solidity
function createReward(ChallengeReward memory challengeReward)
```

# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
GAS_REPORT=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```
