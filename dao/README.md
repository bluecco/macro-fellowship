# DAO Project

## Technical Spec

<!-- Here you should list your DAO specification. You have some flexibility on how you want your DAO's voting system to work and Proposals should be stored, and you need to document that here so that your staff micro-auditor knows what spec to compare your implementation to.  -->
- Anyone can be a member by buying a membership for 1 ETH
- Any member can propose an NFT to buy
- Any member can to vote on proposals
    - With a 25% quorum
- If a proposal pass, the contract will purchase the NFT.
- Any member can execute successful proposals
- NFTMarketplace execution will buy at price set by the marketplace (no target price or max price)
- DAO will use dao balance to buy an nft
- Kept proposal simple for the scope of the project (1 member 1 vote, no cancellation, 2 days voting and then execution)
  - check below!

### Proposal System Spec

`Current Proposal System was approved`

- Any member can make a proposal
- Proposal voting period will be 2 days (not too short, not too long due to marketplace)
  - this will be set on creation, not by input
- A proposal starts at creation (Active state)
- One member can have only create one proposal per time. To create a new one, it needs to wait for execution/failure or the first one **(A)**
  - easier to manage
  - deadlines are not long **(B)**
  - trying to avoid too much proposal at once, making difficult to evaluate between nfts
  - think on what usually happens with governments (at least Italy) when a potential decree has too many proposal inside. it get stuck and time is lost
- Two identical proposal cannot exists (using hash)
- A proposal **CANNOT** be canceled
- 1 membership = 1 vote (basically authorized wallets, NO governance token) **(C)**
- A proposal can be
  - Active - created and in voting period
  - Successful - Quorum reached and yes > no
  - Failed - Quorum reached and yes ≤ no
  - Expired - No quorum reached and time expired
  - Executed
- A proposal can have a description

### Notion comments on Proposal System

**Point (A)**

- Anthony comment: ` I see what you’re trying to do here. I’m okay with approving this, but just be aware that “whales” (more like…mid-size fish lol) will be able to circumvent this by buying a second membership with a second address.`
- My response: `the only thing to resolve would be a KYC or a proof of partecipation (but loose the anon part)`
- Anthony answer: ` Yeah, just wanted to make sure you are aware. Pretty hard thing to solve - totally okay to leave it this way for this project.`

**Point (B)**

- Anthony comment: `How long is each Proposal active? Does the proposer set this at proposal time, or are all proposals identical?`
- My response: `Proposal are active when created and last 2 days (wrote below voting period will be 2 days). Proposer cannot set the time, it’s basically now + 2 days` - add comment here to clarify: they will last 2 days no matter what, **_then_** they can be executed
- Anthony answer (on Discord): `Your reply contains an acceptable decision.`

**Point (C)**
- Anthony comment: `Perfect. Keep it simple. `


### Voting System Spec

`Current Voting System was approved`

- A member can vote if not already voted on current proposal
- A member can vote if deadline is not met
- A member can vote Yes or No
- A member cannot remove its vote
- Quorum refers to total members (25% of total members of the DAO)

## Design Exercise Answer

<!-- Answer the Design Exercise. -->
<!-- In your answer: (1) Consider the tradeoffs of your design, and (2) provide some pseudocode, or a diagram, to illustrate how one would get started. -->

> Per project specs there is no vote delegation; it's not possible for Alice to delegate her voting power to Bob, so that when Bob votes he does so with the voting power of both himself and Alice in a single transaction. This means for someone's vote to count, that person must sign and broadcast their own transaction every time. How would you design your contract to allow for non-transitive vote delegation?

A ballot contract can be created, where proposals and votes will be stored.

A figure like a 'governor' or a person that will give right to vote to people is present (basically who creates the contract)

The user still need to trust the person that will have their vote delegated as a tradeoff (delegated user could still vote something different!). 
Moreover, it could lead to a centralization.

```solidity
contract Ballot {

    struct Voter {
        votePower;
        voted;
        delegate;
        proposal;
    }

    struct Proposal {
        name;
        voteCount;
    }

    address governor;
    mapping(address => Voter) public voters;
    mapping(address => bool) public delegatees;

    Proposal[] public proposals;

    constructor(proposalNamesArray) {
        governor = msg.sender;
        voters[governor].votePower = 1;
        // stores the proposals here or make a function
    }

    // in this case governor is giving power to vote, it could be also automatic based on tokens or other rules
    function rightToVote(voter) external {        
        // check if address is governor, has not already voted and and has right to vote
        voters[voter].votePower = 1;
    }

    // called by the user
    function delegateVote(to) external {
        if (delegatees[msg.sender]) {
            revert("You are a delegetee for a user, cannot delegate to another");
        }
        Voter storage voter = voters[msg.sender];

        // Check voter can vote, if it has already voted and cannot self delegate

        Voter storage delegated = voters[to];
        // check has right to vote
        voter.voted = true;
        voter.delegate = to;
        delegatees[to] = true;

        if (delegated.voted) {
            proposals[delegated.vote].voteCount += voter.votePower;
        } else {
            delegated.voter += sender.voter;
        }
    }

    function vote(proposal) external {
        Voter storage sender = voters[msg.sender];
        if (sender.vote || sender.votePower == 0) revert // no voting power / already voted
        sender.voted = true;
        proposals[proposal].voteCount += sender.votePower;
    }

    // function to check passed proposals

}
```

> What are some problems with implementing transitive vote delegation on-chain? (Transitive means: If A delegates to B, and B delegates to C, then C gains voting power from both A and B, while B has no voting power).

Transitive delegations create chains of trust.

As delegations are revokable at any time, each person within the chain can break it and reclaim its power.

This would take many votes away from the final representative at once.

Transitive delegations can still lead to a few delegates that can over-rule many individuals.

## Useful Commands

Try running some of the following commands:

```shell
npx hardhat help
npx hardhat compile              # compile your contracts
npx hardhat test                 # run your tests
npm run test                     # watch for test file changes and automatically run tests
npx hardhat coverage             # generate a test coverage report at coverage/index.html
REPORT_GAS=true npx hardhat test # run your tests and output gas usage metrics
npx hardhat node                 # spin up a fresh in-memory instance of the Ethereum blockchain
npx prettier '**/*.{json,sol,md}' --write # format your Solidity and TS files
```
