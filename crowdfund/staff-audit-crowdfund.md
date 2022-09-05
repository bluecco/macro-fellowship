https://github.com/0xMacro/student.bluecco/tree/4ce880bed11ecda9e338f0d38332001ca51090eb/crowdfund

Audited By: Gary

# General Comments

I can see that you put a lot of effort into this project.  The test cases that you generated are very comprehensive.  You added additional edge cases to the test suite and reached 100% coverage.  Congratulations on writing code with no vulnerabilities. I am sure your testing contributed to coding no vulnerabilities. 

I have suggested several code quality improvement opportunities in your code to help make your contract more practical, such as: 

- Using Push method instead of the Pull method in claiming the NFT token.  
- Making your contract queryable.  
   
On you next project, please make sure you address the quality issues I stated below.  I think you should be able build upon this project and continue to do well into your next set of projects.    

Awesome first project! 

# Design Exercise

There are various possible approaches to this. Using metadata is one. Another would be to reserve different id ranges for different tiers of NFT. 

But again, great effort in putting thought and effort into this question. Showing the pseudo code to demonstrate the adding of the METADATA and tokenURI was a great way in explaining your solution!

# Issues

**[Extra Feature-1]** Badge trading

Allowing people to trade their NFT badges **via the project contract** is not a requirement for this project. 

The OZ ERC721 contract already allows them to be tradeable (using ERC721.transfer or ERC721.transferFrom). The recommendation is to always try to keep the code as simple as possible, and make it have as few features as possible. Adding "nice to have" features is not encouraged as doing so can introduce, or hide, vulnerabilities and make auditing more difficult.

Consider removing badge trading functionality from your contract.

**[Q-1]**  Token release

The pull pattern for NFT badges isn't needed for security - you can just have them minted immediately after a contribution is made in the contribute function. The pull pattern here also increases the number of transactions a user must make.

**[Q-2]** Project state not queryable

You do a great job designing your contracts for gas efficiency and readability. You manage project "state" (active/failed) via require checks in each function instead of a storage variable, which cuts down on gas costs and contract size. That said, this approach makes it difficult for a front end or outside user to query the status of a contract: "is this Project
 active? Can I contribute to it?".

Consider using an enum data type to represent your contract status (active/failed/cancelled). You could pair the enum with a public view function that returns the correct enum based on the logic checks that you include in each of your functions. This way you can use the same base logic in each function to determine contract state, as well as query contract state externally. Other approaches also work, this is just a suggestion!

**[Q-3]** Unchanged variables should be marked constant or immutable

Your `Project.sol` contract has storage variables that are not updated by any functions and do not change. For these cases, you can save gas and improve readability by marking these variables as either `constant` or `immutable`.

What's the difference? In both cases, the variables cannot be modified after the contract has been constructed. For `constant` variables, the value has to be fixed at compile-time, while for `immutable`, it can still be assigned at construction time.

Compared to regular state variables, the gas costs of `constant` and `immutable` variables are much lower. For a `constant` variable, the expression assigned to it is copied to all the places where it is accessed and also re-evaluated each time. This allows for local optimizations. `Immutable` variables are evaluated once at construction time and their value is copied to all the places in the code where they are accessed. For these values, 32 bytes are reserved, even if they would fit in fewer bytes. Due to this, `constant` values can sometimes be cheaper than `immutable` values.

There are a number of variables set in the `Project.sol` constructor that don't change. Consider marking unchanged storage variables after being updated in the constructor as `immutable`, like this:

```solidity
address public immutable creator;
uint256 public immutable goal;
uint256 public immutable deadline; 
```
Reference: (Solidity Docs: Constant and Immutable State Variables)[https://docs.soliditylang.org/en/v0.8.9/contracts.html#constant-and-immutable-state-variables]

**[Q-4]** Unnecessary initialization of storage variables

This is not needed (and wastes gas) because every variable type has a default value it gets set to upon declaration. 

For example:

```solidity
address a;  // will be initialized to the 0 address (address(0))
uint256 b;   // will be initialized to 0
bool c;        // will be initialized to false
```

Consider not setting initial values for storage variables that would otherwise be equal to their default values in the constructor, as you are doing here:

```solidity
// Lines 20, 21, and 26, respectively.
bool public isCancelled = false;
bool public isComplete = false;
uint256 public totalMints = 0;
```

In addition, no need to initialize state variables in the constructor to their default value:

```solidity
// Line 44    
fundsRaised = 0;
```

**[Q-5]** State variables of contracts are not stored in storage in a compact way causing more gas usage. 

In order to allow the EVM to optimize gas usage, ensure that you to order your storage variables such that they can be packed tightly and into efficient slots. ie. Keep your uint256 variables together.  You declare uint256 variables, followed by two bool and two mapping before declaring another uint256 variable.

See: https://docs.soliditylang.org/en/v0.8.9/internals/layout_in_storage.html

**[Q-6]**  Unnecessary state variables

line 21: variable `isComplete` is unnecessary and costs gas to store.  Instead of storing this variable, you could determine if the goal is met by checking if `fundsRaised >= goal`.

**[Q-7]** Public vs. external functions

If a function is never called from inside your contract, but is designed to be called externally, it is best practice to mark its visibility `external` instead of `public`. This helps with gas savings on initial contract deployment.

Consider changing the relevant functions' visibility to `external` from `public`:

- `withdrawFunds`
-  `refund`
- `cancel`, 
- `mintBadges` 
- `tradeBadge`

**[Q-8]** Checks-Effects-Interaction pattern not always followed

The pattern is described (here)[https://docs.soliditylang.org/en/v0.8.9/security-considerations.html#use-the-checks-effects-interactions-pattern]

Both the `withdrawFunds` and `refund` functions make an external call and then emit an event. It's easy to overlook emitting an event as an effect, since it doesn't change the contract storage, but it's better to do it before any external call. I can't see any serious vulnerability here, but the ordering of events could be messed about with by a reentrant claimer!

**[Q-9]** A transaction reverted without a reason string

Consider adding a revert reason to the require statement in mintBadges.  The qualified contributor will not know the reason for failure. 

# Nitpicks

- Optimize your code to reduce byte code and deployment cost by setting optimizer in the hardhat config file.
  Melville stressed this in class   refer to: https://hardhat.org/config
  ```javascript
  settings: {
      optimizer: {
        enabled: true,
        runs: 200
```

You can save gas by adding this to the hardhat config.

# Score

| Reason | Score |
|-|-|
| Late                       | - |
| Unfinished features        | - |
| Extra features             | 1 |
| Vulnerability              | - |
| Unanswered design exercise | - |
| Insufficient tests         | - |
| Technical mistake          | - |

Total: 1

Great job!