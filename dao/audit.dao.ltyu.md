Category Level
-   `[H-x]` for high severity
-   `[M-x]` for medium severity
-   `[L-x]` for low severity
-   `[Q-x]` for code quality
-   `[N-x]` for Nitpicks

- [L-1] hashProposal can have collisions
	- HashProposal takes in the function args with the description to create a proposalId key, Users will need need to create proposals that always contain a unique description.
		- Consider adding a check to force a user to always include a description
		- Also, it can be hard to keep track of which descriptions have been used. It may be a bad user experience for a user to create multiple proposals but forget their previous description
		- Consider seeding hashProposal with something more predictable, but still unique and not rely on the description. Example: block.timestamp
- [L-2] Default proposal (uncreated) state is "EXPIRED" 
	- Error codes could be misleading to off-chain observers if, for example, a user runs `voteProposal` on an uncreated proposal and get back `ProposalMustBeActive(4)` which desginate a proposal is expired.
- [L-3] No no maxiumum length for targets 
	- This allows arbitrary amount of functions to be created which can lead to creation of un-executable proposals. 
- [Q-2] numVotes not be needed as that can be calculated
	- We can save some storage access (and thus gas) if we calculate numVotes by summing 'yes' and 'no' variables. Consider removing numVotes.
- [Q-4]VerifySignature return true not handled 
	- Consider removal
- [Q-5] Unnecessary memory storage
	- in Line 328, `uint256 endAt = proposal.endAt`,  endAt only gets used once so the storing it in memory is unnessary.
- [N-1] Function ordering does not follow [Solidity guide](https://docs.soliditylang.org/en/v0.8.15/style-guide.html#order-of-layout)
```
Functions should be grouped according to their visibility and ordered:
1. constructor
2. receive function (if exists)
3. fallback function (if exists)
4. external
5. public
6. internal
7. private
```
- [N-2] Unclear `description` argument in `createProposal`
	- Not seeing this in the natspec