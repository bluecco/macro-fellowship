# Multisig Project

## Deliverables

My Gnosis Safe can be found here: [proj-multisig-macro](https://gnosis-safe.io/app/rin:0x1FbE308e5838B3Af10EAF13650461198BA78810d/home)

Contracts have been deployed to Rinkeby at the following addresses:

| Contract      | Address Etherscan Link                                                                                                        | Transaction Etherscan Link                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Multisig      | [0x1FbE308e5838B3Af10EAF13650461198BA78810d](https://rinkeby.etherscan.io/address/0x1FbE308e5838B3Af10EAF13650461198BA78810d) | [0x96836fedceb35390e2c5f4e2950873d03f2da26ea7275c1f6a38948f5e7dac1c](https://rinkeby.etherscan.io/tx/0x96836fedceb35390e2c5f4e2950873d03f2da26ea7275c1f6a38948f5e7dac1c) |
| Proxy         | [0x2b899f613d3D44C71c88D75E83defDfB145a33DB](https://rinkeby.etherscan.io/address/0x2b899f613d3D44C71c88D75E83defDfB145a33DB) | [0x8e6527cd06a58880a54f25910b19127a17aedc62d6b0727ddafc0d4c309f98af](https://rinkeby.etherscan.io/tx/0x8e6527cd06a58880a54f25910b19127a17aedc62d6b0727ddafc0d4c309f98af) |
| Logic         | [0xFb5bcA5afe25636aB8fC22eA1728821E0Ea1f10a](https://rinkeby.etherscan.io/address/0xFb5bcA5afe25636aB8fC22eA1728821E0Ea1f10a) | [0x1f22d0fc706513a4bb9a781de92c435d712bbc8fdded40f55e13eec96d80c45e](https://rinkeby.etherscan.io/tx/0x1f22d0fc706513a4bb9a781de92c435d712bbc8fdded40f55e13eec96d80c45e) |
| LogicImproved | [0x1E11e1C37B75936667DDb95e28812953db81EAE0](https://rinkeby.etherscan.io/address/0x1E11e1C37B75936667DDb95e28812953db81EAE0) | [0x124ccc7c3ca29579072c1e0eb5d6f3f87301f6100900cc25a046e866c1bd800b](https://rinkeby.etherscan.io/tx/0x124ccc7c3ca29579072c1e0eb5d6f3f87301f6100900cc25a046e866c1bd800b) |

Transaction for transferring the ownership of the **Proxy** contract to the multisig:

| Contract | Transaction Etherscan Link                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| Proxy    | [transferOwnership](https://rinkeby.etherscan.io/tx/0x32f39a0e473257cf7ae390ef939d9ca55006adee23449791844efbf1302782ee) |

Transaction calling `upgrade(address)` to upgrade the **Proxy** from **Logic** -> **LogicImproved**

| Contract | Function called | Transaction Etherscan Link                                                                                                                                               |
| -------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Proxy    | `upgrade`       | [0xa83da1636f7ecc07ab7bf23b8a6b098fb1e4897ac2d27f40fd6289f42190e506](https://rinkeby.etherscan.io/tx/0xa83da1636f7ecc07ab7bf23b8a6b098fb1e4897ac2d27f40fd6289f42190e506) |

# Design exercise

> Consider and write down the positive and negative tradeoffs of the following configurations for a multisig wallet. In particular, consider how each configuration handles the common failure modes of wallet security.

> - 1-of-N

> - M-of-N (where M: such that 1 < M < N)

> - N-of-N

## 1-of-N

### Advantages

- good for individuals

- fast speed of execution since only 1 signer

- only 1 key and 1 seed phrase needed

- easy to setup and use

- everything is managed by the user without depending on other users

### Disadvantages

- single point of failure

- if the user loose keys (or are damaged or physicall stolen), then it cannot access to the funds anymore

- if the user sends fund to a wrong address or put the wrong amount, it cannot be stopped

  - you have to trust every single individual if part of an organization

### M-of-N (where M: such that 1 < M < N)

### Advantages

- reduce dependancy on 1 person (distributing keys over members)

- having a quorum means that M signature are needed (and not all)

- avoid single point of failure (that would happen in both 1-N or N-N case)

- leaves room for error in losing or forgetting your keys

- if keys are stolen (`N - M, ie: 2-of-3 it one key is stolen but not the other two`) but quorum is still up, attacks can be prevented / funds are accessible

- prevent transactions to wrong addresses / wrong amounts

- harder attacks in general (especially if sigs are linked with hardware wallets)

- lessen the dependence on one device

- improve hot wallet security

### Disadvantages

- requires tech knowledge (more complicate than 1-of-N)

- no legal custodians of funds deposited into a shared wallet with multiple keyholders

- need multiple private keys / seed phrase to backup somehow

- if keys are distributed geographically (ie: 1 NA, 1 EU, 1 Asia) il could be hard to approve transactions

- basically execution speed could be slow due to the need to rely on the reaction time of the other key signers

- It requires importing each of the recovery phrases on a different device

- recovery process long since it requires M recovery phrases to import

### N-of-N

### Advantages

- distributing keys over members

- prevent transactions to wrong addresses / wrong amounts

- harder attacks in general

- improve hot wallet security

### Disadvantages

- single point of failure, if even one of the members loose the keys (or get them stolen) nobody then can access to funds or perform transactions

- a single signer could block everything on purpose (blackmail, prevent use of funds for personal reason, anything)

- need to wait for **ALL** signers instead of only a quorum

- requires tech knowledge (more complicate than 1-of-N)

- no legal custodians of funds deposited into a shared wallet with multiple keyholders

- execution speed is slow since there is the need to rely on the reaction time of the other key signers

- recovery process long since it requires **ALL** recovery phrases to import
