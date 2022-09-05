# Crowdfund Project

## Technical Spec
<!-- Here you should list the technical requirements of the project. These should include the points given in the project spec, but will go beyond what is given in the spec because that was written by a non-technical client who leaves it up to you to fill in the spec's details -->

- Project creation:
  - smart contract is reusable and multiple projects can be registered. ETH can be accepted simultaneously
    - factory contract pattern need to be used
  - a creator register a project with a name and funds goal
    - goal cannot be changed once project is created
  - once the project is registered, the campaign starts with a fixed duration of 30 days
  - the creator can cancel the project if the 30 days are not passed (and goal is not reached)

- Project Contribution:
  - contributor can contribute with a minimum of 0.01ETH (otherwise it will be rejected). 
  - no upper limit
  - any user can contribute, creator included
  - contributors can contribute more than once to a project (if it's not cancelled or failed)
  - funds can be refund ONLY if a project has failed or cancelled
  - users CANNOT ask for a refund while a project funding is running

- Fully funded project:
  - a project is considered fully funded if the goal is achieved before the 30 days limit
  - No one else can contribute 
    - only last contribution can go over the goal
  - The creator can withdraw any amount of contributed funds
  - users CANNOT ask for a refund if a project is fully funded

- 30 days passed and project didn't reach the goal:
  - project is considered failed
  - no one can contribute
  - contributors can ask a refund and get money back
  - contributor can still get badges based on their donations
    - those should still be tradable.

- Badges:
  - a contributor is awarded with a badge if their total contribution is AT LEAST 1 ETH
    - contribution of 1 ETH doesn't need to beh at the same time, but achieved with multiple contributions
  - a contributor can receive multiple badges on a project
    - it will receive a badge per 1 ETH contributed
  - Each project should use its own NFT contract
  - project creators can earn badges




## Design Exercise Answer
<!-- Answer the Design Exercise. -->
<!-- In your answer: (1) Consider the tradeoffs of your design, and (2) provide some pseudocode, or a diagram, to illustrate how one would get started. -->
> Smart contracts have a hard limit of 24kb. Crowdfundr hands out an NFT to everyone who contributes. However, consider how Kickstarter has multiple contribution tiers. How would you design your contract to support this, without creating three separate NFT contracts?

Answer:  

NFT Metadata are mandatory in this case.  
Metadata will hold the information about a badge (ie: level and tierName) and tell the user which type contributor was for the project.  
Having metadata telling what an NFT is allow us to not use three different contracts because we're basically "expanding" the NFT with them.  
Contract just need to implement a little logic to define the tiers and "attach it" to the NFT badge.  
The contract will need to implement ERC721 tokenUri (json file that list attributes) to retrieve the metadata.  

With this contract, since there are few metadata to add (so it's small), metadata could be saved directly on the blockchain.  
if we would have more information to store we could  
- BEST PRACTICE: use IPFS  
- use an off chain solution for a cheap solution but that would be centralized and could potentially make the NFT worthless like  
    - an attack could wipe nft metadata  
    - there is maintenance  
    - the provider just stop working  



For simplicity I kept that a user can have one badge in the following pseudo code  
Pseudo code 
```
contract Project is ERC721 {
  ...
  struct NftAttributes {
      uint256 level;
      string tierName;
  }

  // tokenId => attributes
  mapping(uint256 => NftAttributes) public nftHolderAttributes;
  ...

  function mintBadge() public {
    // logic for tier membership like
    // 1 ETH = level 1 - tiername base
    // 5 ETH = level 2 - tiername angel
    // 10 ETH = level 3 - tiername venture capitalist

    // actual logic here

    addressToBadges[msg.sender]++;
    uint256 tokenId = totalMints;
    totalMints++;
    _safeMint(msg.sender, tokenId);

    // ADD NFT METADATA
    nftHolderAttributes[tokenId] = NftAttributes({
      level: levelBasedOnSomeCondition,
      tierName: tierNameBasedOnSomeCondition,
    });
  }

  function tokenURI(uint256 _tokenId)
    public
    view
    override
    returns (string memory)
  {
    ContributorBadgeAttributes memory nftAttributes = nftHolderAttributes[_tokenId];
    string memory tierLevel = Strings.toString(charAttributes.hp);
  
    string memory json = Base64.encode(
        abi.encodePacked(
          '{',
          " Name:", somename, " - NFT#", Strings.toString(_tokenId),
          '", tierName": "', tierName,
          '", tierLevel": "', level,
          '", Name": "', level,
          "}"
        )
    );

    string memory output = string(
        abi.encodePacked("data:application/json;base64,", json)
    );

    return output;
  }
}
```


## Useful Commands

Try running some of the following commands:

```shell
npx hardhat help
npx hardhat compile              # compile your contracts
npx hardhat test                 # run your tests
npm run test                     # watch for test file changes and automatically run tests
npx hardhat coverage             # generate a test coverage report at coverage/index.html
GAS_REPORT=true npx hardhat test # run your tests and output gas usage metrics
npx hardhat node                 # spin up a fresh in-memory instance of the Ethereum blockchain
npx prettier '**/*.{json,sol,md}' --write # format your Solidity and TS files
```
