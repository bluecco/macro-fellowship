// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Import this file to use console.log
import "hardhat/console.sol";

import "./INftMarketplace.sol";
import "./ERC721Receiver.sol";

contract CollectorDao is ERC721Receiver {
    struct Proposal {
        uint256 yes;
        uint256 no;
        uint256 endAt;
        uint256 numVoters;
        bool executed;
        mapping(address => bool) voters;
    }

    uint256 public totalMembers;

    string constant name = "CollectorsDAO";

    mapping(address => bool) public members;
    mapping(address => uint256) public membersWithProposals;
    mapping(uint256 => Proposal) public proposals;

    bytes32 public constant EIP712_DOMAIN =
        keccak256(
            "EIP712Domain(string name,uint256 chainId,address verifyingContract)"
        );
    bytes32 public constant VOTE_TYPEHASH =
        keccak256("Vote(uint256 proposalId,uint8 vote)");

    enum Vote {
        YES,
        NO
    }

    enum ProposalState {
        Active,
        Executed,
        Successful,
        Failed,
        Expired,
        NotExists
    }

    /// @dev check if it's a member of CollectorDao
    function onlyMember(address _sender) internal view {
        if (!members[_sender]) {
            revert NotMember(_sender);
        }
    }

    /// @notice let a user to buy a membership for the Dao.
    /// @dev Price is 1 ETH
    function buyMembership() external payable {
        if (members[msg.sender]) revert AlreadyMember(msg.sender);
        if (msg.value != 1 ether) revert MustBeOneEther();

        members[msg.sender] = true;
        totalMembers++;

        emit NewMember(msg.sender);
    }

    /**
     * @notice let members to create a new proposal within the Dao
     *
     * @dev the method will return the proposalId (hash of proposed function calls combined)
     * A proposal will fail if:
     * - the current member has an already active proposal
     * - no target addresses are passed to this function
     * - there is a mismatch between addresses and values/calldata
     * - it already exists (duplicate)
     *
     * @param targets addresses that will invoke call function
     * @param values eth values used by call function
     * @param calldatas calldata passed to the call function
     */
    function createProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) external returns (uint256) {
        onlyMember(msg.sender);
        uint256 currentMemberProposal = membersWithProposals[msg.sender];

        if (state(currentMemberProposal) == ProposalState.Active) {
            revert MemberHaveActiveProposal(currentMemberProposal);
        }

        if (targets.length == 0) {
            revert EmptyProposal(currentMemberProposal);
        }

        if (
            targets.length != values.length ||
            targets.length != calldatas.length
        ) {
            revert InvalidProposalLength(currentMemberProposal);
        }

        uint256 proposalId = hashProposal(
            targets,
            values,
            calldatas,
            keccak256(bytes(description))
        );
        /* since there is no method to check if a struct value exists in a mapping, check if endAt has the default value */
        if (proposals[proposalId].endAt > 0) {
            revert DuplicateProposal(proposalId);
        }

        Proposal storage proposal = proposals[proposalId];
        proposal.endAt = block.timestamp + 7 days;
        membersWithProposals[msg.sender] = proposalId;

        emit ProposalCreated(proposalId);

        return proposalId;
    }

    /**
     * @notice let members to vote on a proposal
     *
     * @param proposalId The hash of proposed function calls combined
     * @param vote The vote the member is giving
     */
    function voteProposal(uint256 proposalId, Vote vote) public {
        _voteProposal(msg.sender, proposalId, vote);
    }

    /**
     * @notice internal function that actually vote on a proposal
     *
     * @dev A vote will fail if:
     * - the current proposal is not active
     * - the member has already voted
     *
     * @param voter address of the current voter
     * @param proposalId The hash of proposed function calls combined
     * @param vote The vote the member is giving
     */
    function _voteProposal(
        address voter,
        uint256 proposalId,
        Vote vote
    ) internal {
        onlyMember(voter);
        ProposalState currentState = state(proposalId);
        if (currentState != ProposalState.Active) {
            revert ProposalMustBeActive(currentState);
        }

        Proposal storage proposal = proposals[proposalId];
        if (proposal.voters[voter]) {
            /* Prevent replay attack */
            revert AlreadyVoted(voter);
        }

        proposal.voters[voter] = true;
        proposal.numVoters++;
        if (vote == Vote.YES) {
            proposal.yes++;
        } else {
            proposal.no++;
        }

        emit MemberVoted(voter);
    }

    /**
     * @notice let members to execute a voted proposal
     *
     * @dev proposal won't execute if
     * - it was already executed
     * - it didn't pass
     *
     * @param targets addresses that will invoke call function
     * @param values eth values used by call function
     * @param calldatas calldata passed to the call function
     */
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public payable {
        onlyMember(msg.sender);
        uint256 proposalId = hashProposal(
            targets,
            values,
            calldatas,
            descriptionHash
        );

        ProposalState currentState = state(proposalId);
        if (currentState == ProposalState.Executed) {
            revert ProposalAlreadyExecuted(proposalId);
        }

        if (currentState != ProposalState.Successful) {
            revert ProposalCannotBeExecuted(currentState);
        }

        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;
        membersWithProposals[msg.sender] = 0;

        emit ProposalExecuted(proposalId);

        for (uint256 i = 0; i < targets.length; ++i) {
            (bool success, bytes memory data) = targets[i].call{
                value: values[i]
            }(calldatas[i]);
            /*
             *
             * If balance is not enough and transaction wouldn't be reverted, a new proposal would be needed instead of just adding funds on DAO
             * same for other arbitrary functions.
             * Instead, if we have an error that it's comprehensible and can be "fixed" (like add funds)
             * It doesn't makes sense to make this one as executed and create a new proposal
             *
             */
            verifyResult(success, data);
        }
    }

    /**
     *
     * @dev verify if arbitrary function was successful. If it wasn't, check if there was an error throwed and revert with that.
     * Otherwise, with a generic error
     *
     * @param success call has been successful
     * @param data byte received from the arbitrary function
     *
     */
    function verifyResult(bool success, bytes memory data)
        internal
        pure
        returns (bytes memory)
    {
        if (success) {
            return data;
        } else {
            // Look if call sent some error
            if (data.length > 0) {
                // "Catch" the revert reason using memory via assembly
                assembly {
                    let data_size := mload(data)
                    revert(add(32, data), data_size)
                }
            } else {
                revert ExecutionError("Someting went wrong");
            }
        }
    }

    /**
     * @dev method to cast votes in bulk using off chain signatures
     * Used memory instead of calldata due to: Stack too deep when compiling inline assembly
     *
     * @param signers array of original signers
     * @param proposalIds array of proposals
     * @param votes of votes
     *
     */
    function castVoteBySigBulk(
        address[] memory signers,
        uint256[] memory proposalIds,
        Vote[] memory votes,
        uint8[] memory v,
        bytes32[] memory r,
        bytes32[] memory s
    ) external {
        for (uint256 i; i < signers.length; i++) {
            castVoteBySig(
                signers[i],
                proposalIds[i],
                votes[i],
                v[i],
                r[i],
                s[i]
            );
        }
    }

    /**
     * @dev method to cast the votes
     *
     * @param signer original signer
     * @param proposalId proposalId to vote
     * @param vote signer's vote
     *
     */
    function castVoteBySig(
        address signer,
        uint256 proposalId,
        Vote vote,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        verifySignature(signer, proposalId, vote, v, r, s);
        _voteProposal(signer, proposalId, vote);
    }

    /**
     * @dev method to cast the votes
     *
     * @param signer original signer
     * @param proposalId proposalId to vote
     * @param vote signer's vote
     *
     */
    function verifySignature(
        address signer,
        uint256 proposalId,
        Vote vote,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public view returns (bool) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        bytes32 domainSeparator = keccak256(
            abi.encode(
                EIP712_DOMAIN,
                keccak256(bytes(name)),
                chainId,
                address(this)
            )
        );
        bytes32 structHash = keccak256(
            abi.encode(VOTE_TYPEHASH, proposalId, vote)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator, structHash)
        );

        address actualSigner = ecrecover(digest, v, r, s);

        if (actualSigner != signer) {
            revert WrongSignature(signer);
        }

        return true;
    }

    /**
     * @notice retrieve a proposal's status
     *
     * @param proposalId the id of the proposal
     */
    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];

        if (proposal.endAt == 0) {
            return ProposalState.NotExists;
        }

        if (proposal.executed) {
            return ProposalState.Executed;
        }

        uint256 endAt = proposal.endAt;
        if (block.timestamp < endAt) {
            return ProposalState.Active;
        }

        /* design decision: ceiling quorum as tradeoff since we cannot have floats -- better quorum with low numbers
         * ie: 25% of 115 voters = 28.75 -> with solidity it would be truncated to 28. I think more correct to have 29
         * ie: 25% of 113 voters = 28.25 -> with solidity it would be truncated to 28 again. I prefer to uniform with ceiling so it will end up with 29 again
         */
        uint256 ceiledQuorum = (((totalMembers * 25) - 1) / 100) + 1;
        if (proposal.numVoters >= ceiledQuorum) {
            return
                proposal.yes > proposal.no
                    ? ProposalState.Successful
                    : ProposalState.Failed;
        }
        return ProposalState.Expired;
    }

    /**
     * @notice buy an NFT from our trusted NFT marketplace
     *
     * @param nftMarketplaceContract marketplace contract address
     * @param nftContract contract address
     * @param nftId the id of the NFT to buy
     */
    function buyNftFromMarketplace(
        address nftMarketplaceContract,
        address nftContract,
        uint256 nftId,
        uint256 maxPrice
    ) public returns (bool) {
        // function can be used only by DAO proposals
        if (msg.sender != address(this)) revert OnlyContractCanBuy(msg.sender);
        uint256 _nftPrice = INftMarketplace(nftMarketplaceContract).getPrice(
            nftContract,
            nftId
        );

        if (_nftPrice > maxPrice) {
            revert PriceTooHigh(maxPrice, _nftPrice);
        }

        if (address(this).balance < _nftPrice) {
            revert NotEnoughBalance(address(this).balance, _nftPrice);
        }

        bool success = INftMarketplace(nftMarketplaceContract).buy{
            value: _nftPrice
        }(nftContract, nftId);

        if (success) {
            emit NftBought(
                nftMarketplaceContract,
                nftContract,
                nftId,
                _nftPrice
            );
        } else {
            revert NftCannotBeBought(
                nftMarketplaceContract,
                nftContract,
                nftId,
                _nftPrice
            );
        }

        return success;
    }

    /**
     * @dev return the hash hash of proposed function calls combined)
     *
     * @param targets addresses that will invoke call function
     * @param values eth values used by call function
     * @param calldatas calldata passed to the call function
     */
    function hashProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public pure virtual returns (uint256) {
        return
            uint256(
                keccak256(
                    abi.encode(targets, values, calldatas, descriptionHash)
                )
            );
    }

    event NewMember(address);
    event MemberVoted(address);
    event ProposalCreated(uint256);
    event ProposalExecuted(uint256);
    event NftBought(address, address, uint256, uint256);

    error NotMember(address);
    error AlreadyMember(address);
    error MustBeOneEther();
    error AlreadyVoted(address);
    error ProposalMustBeActive(ProposalState);
    error EmptyProposal(uint256);
    error InvalidProposalLength(uint256);
    error MemberHaveActiveProposal(uint256);
    error ProposalCannotBeExecuted(ProposalState);
    error ProposalAlreadyExecuted(uint256);
    error NotEnoughBalance(uint256, uint256);
    error PriceTooHigh(uint256, uint256);
    error ExecutionError(string);
    error DuplicateProposal(uint256);
    error OnlyContractCanBuy(address);
    error NftCannotBeBought(address, address, uint256, uint256);
    error WrongSignature(address);
}
