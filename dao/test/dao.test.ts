import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { CollectorDao } from "../typechain-types";
import { NftMarketplace } from "../typechain-types/test";

import { domain, types, ballot } from "./helpers/typedData";
import { Vote, ProposalState } from "./helpers/enums";

const SECONDS_IN_DAY: number = 60 * 60 * 24;
const ONE_ETHER: BigNumber = ethers.utils.parseEther("1");
const NFT_ID_MARKETPLACE_RETURN_FALSE = 5;
const NFT_ID_MARKETPLACE_REVERT_ERROR = 12;

const toBytes32 = (value: string) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));

const generateNftMarketplaceData = (
  target: string,
  nftMarketplaceAddress: string,
  nftId: number,
  maxPrice: BigNumber
) => {
  let ABI = [
    "function buyNftFromMarketplace(address nftMarketplaceContract, address nftContract, uint256 nftId, uint256 maxPrice)",
  ];
  let iface = new ethers.utils.Interface(ABI);
  const calldata = iface.encodeFunctionData("buyNftFromMarketplace", [
    nftMarketplaceAddress,
    nftMarketplaceAddress,
    nftId,
    maxPrice,
  ]);
  return {
    targets: [target],
    values: [BigNumber.from(0)],
    calldatas: [calldata],
  };
};

const timeTravel = async (seconds: number) => {
  await time.increase(seconds);
};

describe("DAO", function () {
  async function setupFixture() {
    const signers = await ethers.getSigners();
    const [deployer, proposer, voter1, voter2, voter3, voter4, voter5, voter6, nonMember]: SignerWithAddress[] =
      signers;

    const CollectorDao = await ethers.getContractFactory("CollectorDao");
    const collectorDao: CollectorDao = (await CollectorDao.deploy()) as CollectorDao;
    await collectorDao.deployed();

    const NftMarketplace = await ethers.getContractFactory("NftMarketplace");
    const nftMarketplace: NftMarketplace = (await NftMarketplace.deploy()) as NftMarketplace;
    await nftMarketplace.deployed();

    await collectorDao.connect(proposer).buyMembership({
      value: ONE_ETHER,
    });
    await collectorDao.connect(voter1).buyMembership({
      value: ONE_ETHER,
    });
    await collectorDao.connect(voter2).buyMembership({
      value: ONE_ETHER,
    });
    await collectorDao.connect(voter3).buyMembership({
      value: ONE_ETHER,
    });
    await collectorDao.connect(voter4).buyMembership({
      value: ONE_ETHER,
    });
    await collectorDao.connect(voter5).buyMembership({
      value: ONE_ETHER,
    });
    await collectorDao.connect(voter6).buyMembership({
      value: ONE_ETHER,
    });

    return {
      proposer,
      voter1,
      voter2,
      voter3,
      voter4,
      voter5,
      voter6,
      nonMember,
      collectorDao,
      deployer,
      nftMarketplaceAddress: nftMarketplace.address,
    };
  }
  describe("Deployment", function () {
    it("Should deploy", async function () {
      const CollectorDao = await ethers.getContractFactory("CollectorDao");
      const collectorDao: CollectorDao = (await CollectorDao.deploy()) as CollectorDao;
      await collectorDao.deployed();
      expect(collectorDao.address).not.be.null;
    });
  });

  describe("Membership", function () {
    it("User become a member for 1ETH", async function () {
      const { collectorDao, nonMember } = await loadFixture(setupFixture);
      await collectorDao.connect(nonMember).buyMembership({
        value: ONE_ETHER,
      });

      expect(await collectorDao.members(nonMember.address)).to.be.true;
      expect(await collectorDao.totalMembers()).to.be.equal(8);
    });

    it("User cannot buy multiple a memberships", async function () {
      const { collectorDao, nonMember } = await loadFixture(setupFixture);
      await collectorDao.connect(nonMember).buyMembership({
        value: ONE_ETHER,
      });

      expect(await collectorDao.members(nonMember.address)).to.be.true;
      expect(await collectorDao.totalMembers()).to.be.equal(8);
      await expect(
        collectorDao.connect(nonMember).buyMembership({
          value: ONE_ETHER,
        })
      )
        .to.be.revertedWithCustomError(collectorDao, "AlreadyMember")
        .withArgs(nonMember.address);
    });

    it('Emits "NewMember" event after buying a membership', async function () {
      const { collectorDao, nonMember } = await loadFixture(setupFixture);

      let buyMembershipTxn = await collectorDao.connect(nonMember).buyMembership({
        value: ONE_ETHER,
      });

      await buyMembershipTxn.wait();
      await expect(buyMembershipTxn).to.emit(collectorDao, "NewMember").withArgs(nonMember.address);
    });

    it('Revert with "MustBeOneEther" if amount sent is not 1 ETH', async function () {
      const { collectorDao, nonMember } = await loadFixture(setupFixture);

      await expect(
        collectorDao.connect(nonMember).buyMembership({
          value: ONE_ETHER.add(1),
        })
      ).to.be.revertedWithCustomError(collectorDao, "MustBeOneEther");

      await expect(
        collectorDao.connect(nonMember).buyMembership({
          value: ethers.utils.parseEther("0.1"),
        })
      ).to.be.revertedWithCustomError(collectorDao, "MustBeOneEther");
      /* .withArgs("ALREADY_IN_OPEN_PHASE"); */
    });

    /* TODO: emit error on call-- see crowdfundr */
  });

  describe("Proposal", function () {
    it("Allow member to create a proposal", async function () {
      const { collectorDao, proposer, nftMarketplaceAddress } = await loadFixture(setupFixture);
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );
      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
    });

    it('Emit "ProposalCreated" event after proposal creation', async function () {
      const { collectorDao, proposer, nftMarketplaceAddress } = await loadFixture(setupFixture);
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      let createProposalTx = await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");

      await createProposalTx.wait();
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));
      await expect(createProposalTx).to.emit(collectorDao, "ProposalCreated").withArgs(proposalId);
    });

    it("Block proposal creation if no targets are specified", async function () {
      const { collectorDao, proposer } = await loadFixture(setupFixture);

      await expect(collectorDao.connect(proposer).createProposal([], [], [], ""))
        .to.be.revertedWithCustomError(collectorDao, "EmptyProposal")
        .withArgs(0);
    });

    it("Block proposal creation if targets mismatch with values or calldata", async function () {
      const { collectorDao, proposer, nftMarketplaceAddress } = await loadFixture(setupFixture);
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await expect(
        collectorDao.connect(proposer).createProposal(targets, [...values, BigNumber.from(1)], calldatas, "")
      )
        .to.be.revertedWithCustomError(collectorDao, "InvalidProposalLength")
        .withArgs(0);

      await expect(collectorDao.connect(proposer).createProposal(targets, values, [...calldatas, ...calldatas], ""))
        .to.be.revertedWithCustomError(collectorDao, "InvalidProposalLength")
        .withArgs(0);
    });

    it("Block proposal creation if member has already created one and it's active", async function () {
      const { collectorDao, proposer, nftMarketplaceAddress } = await loadFixture(setupFixture);
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));
      await expect(collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft 2"))
        .to.be.revertedWithCustomError(collectorDao, "MemberHaveActiveProposal")
        .withArgs(proposalId);
    });

    it("Block member to duplicate a proposal", async function () {
      const { collectorDao, proposer, voter1, nftMarketplaceAddress } = await loadFixture(setupFixture);
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );
      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));
      await expect(collectorDao.connect(voter1).createProposal(targets, values, calldatas, "Buy nft"))
        .to.be.revertedWithCustomError(collectorDao, "DuplicateProposal")
        .withArgs(proposalId);
    });
  });

  describe("Voting", function () {
    it("Allow members to vote a proposal", async function () {
      const { collectorDao, proposer, voter1, voter2, nftMarketplaceAddress } = await loadFixture(setupFixture);
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);

      expect((await collectorDao.proposals(proposalId)).numVoters).to.be.equal(1);
      expect((await collectorDao.proposals(proposalId)).yes).to.be.equal(1);

      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.no);
      expect((await collectorDao.proposals(proposalId)).numVoters).to.be.equal(2);
      expect((await collectorDao.proposals(proposalId)).no).to.be.equal(1);
    });

    it("Block non member to vote a proposal", async function () {
      const { collectorDao, proposer, nonMember, nftMarketplaceAddress } = await loadFixture(setupFixture);
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await expect(collectorDao.connect(nonMember).voteProposal(proposalId, Vote.no))
        .to.be.revertedWithCustomError(collectorDao, "NotMember")
        .withArgs(nonMember.address);
    });

    it("Block members to vote more than once", async function () {
      const { collectorDao, proposer, voter1, nftMarketplaceAddress } = await loadFixture(setupFixture);
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await expect(collectorDao.connect(voter1).voteProposal(proposalId, Vote.no))
        .to.be.revertedWithCustomError(collectorDao, "AlreadyVoted")
        .withArgs(voter1.address);
    });

    it("Block vote if proposal is expired", async function () {
      const { collectorDao, proposer, voter1, nftMarketplaceAddress } = await loadFixture(setupFixture);
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await timeTravel(SECONDS_IN_DAY * 8);
      await expect(collectorDao.connect(voter1).voteProposal(proposalId, Vote.no))
        .to.be.revertedWithCustomError(collectorDao, "ProposalMustBeActive")
        .withArgs(ProposalState.Expired);
    });

    it("Block vote if proposal is already voted and passed", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.yes);

      await timeTravel(SECONDS_IN_DAY * 8);
      await expect(collectorDao.connect(voter1).voteProposal(proposalId, Vote.no))
        .to.be.revertedWithCustomError(collectorDao, "ProposalMustBeActive")
        .withArgs(ProposalState.Successful);
    });

    it("Block vote if proposal is already voted and failed", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.no);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.no);

      await timeTravel(SECONDS_IN_DAY * 8);
      await expect(collectorDao.connect(voter4).voteProposal(proposalId, Vote.no))
        .to.be.revertedWithCustomError(collectorDao, "ProposalMustBeActive")
        .withArgs(ProposalState.Failed);
    });

    it("Block vote of a proposal if it was aready executed", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER.mul(2)
      );
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter4).voteProposal(proposalId, Vote.yes);

      await timeTravel(SECONDS_IN_DAY * 8);

      await collectorDao.connect(voter1).execute(targets, values, calldatas, toBytes32("Buy nft"));
      await expect(collectorDao.connect(proposer).voteProposal(proposalId, Vote.no))
        .to.be.revertedWithCustomError(collectorDao, "ProposalMustBeActive")
        .withArgs(ProposalState.Executed);
    });

    it("Vote with offchain generated signature", async function () {
      const { collectorDao, proposer, voter1, nftMarketplaceAddress } = await loadFixture(setupFixture);

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      const signature = await voter1._signTypedData(domain(collectorDao.address), types, ballot(proposalId, Vote.yes));
      const split = ethers.utils.splitSignature(signature);

      let castVoteBySigTx = await collectorDao.castVoteBySig(
        voter1.address,
        proposalId,
        Vote.yes,
        split.v,
        split.r,
        split.s
      );
      await castVoteBySigTx.wait();
      await expect(castVoteBySigTx).to.emit(collectorDao, "MemberVoted").withArgs(voter1.address);
      expect((await collectorDao.proposals(proposalId)).yes).to.be.equal(1);
      expect((await collectorDao.proposals(proposalId)).no).to.be.equal(0);
      expect((await collectorDao.proposals(proposalId)).numVoters).to.be.equal(1);
    });

    it("Vote with offchain generated signature in bulk", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));
      collectorDao.connect(proposer).voteProposal(proposalId, Vote.yes);

      const split = ethers.utils.splitSignature(
        await voter1._signTypedData(domain(collectorDao.address), types, ballot(proposalId, Vote.yes))
      );
      const split2 = ethers.utils.splitSignature(
        await voter2._signTypedData(domain(collectorDao.address), types, ballot(proposalId, Vote.no))
      );
      const split3 = ethers.utils.splitSignature(
        await voter3._signTypedData(domain(collectorDao.address), types, ballot(proposalId, Vote.yes))
      );
      const split4 = ethers.utils.splitSignature(
        await voter4._signTypedData(domain(collectorDao.address), types, ballot(proposalId, Vote.yes))
      );

      let castVoteBySigTx = await collectorDao.castVoteBySigBulk(
        [voter1.address, voter2.address, voter3.address, voter4.address],
        [proposalId, proposalId, proposalId, proposalId],
        [Vote.yes, Vote.no, Vote.yes, Vote.yes],
        [split.v, split2.v, split3.v, split4.v],
        [split.r, split2.r, split3.r, split4.r],
        [split.s, split2.s, split3.s, split4.s]
      );
      await castVoteBySigTx.wait();
      await expect(castVoteBySigTx).to.emit(collectorDao, "MemberVoted").withArgs(voter1.address);
      await expect(castVoteBySigTx).to.emit(collectorDao, "MemberVoted").withArgs(voter2.address);
      await expect(castVoteBySigTx).to.emit(collectorDao, "MemberVoted").withArgs(voter3.address);
      await expect(castVoteBySigTx).to.emit(collectorDao, "MemberVoted").withArgs(voter4.address);

      expect((await collectorDao.proposals(proposalId)).yes).to.be.equal(4);
      expect((await collectorDao.proposals(proposalId)).no).to.be.equal(1);
      expect((await collectorDao.proposals(proposalId)).numVoters).to.be.equal(5);
    });

    it("Block with wrong offchain generated signature", async function () {
      const { collectorDao, proposer, voter1, nftMarketplaceAddress } = await loadFixture(setupFixture);

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      /* vote no */
      const signature = await voter1._signTypedData(domain(collectorDao.address), types, ballot(proposalId, Vote.no));
      const split = ethers.utils.splitSignature(signature);

      /* vote yes */
      await expect(collectorDao.castVoteBySig(voter1.address, proposalId, Vote.yes, split.v, split.r, split.s))
        .to.be.revertedWithCustomError(collectorDao, "WrongSignature")
        .withArgs(voter1.address);
      expect((await collectorDao.proposals(proposalId)).yes).to.be.equal(0);
      expect((await collectorDao.proposals(proposalId)).no).to.be.equal(0);
      expect((await collectorDao.proposals(proposalId)).numVoters).to.be.equal(0);
    });

    it("Block cast vote by offchain signature if same already voted", async function () {
      const { collectorDao, proposer, voter1, nftMarketplaceAddress } = await loadFixture(setupFixture);

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      const signature = await voter1._signTypedData(domain(collectorDao.address), types, ballot(proposalId, Vote.yes));
      const split = ethers.utils.splitSignature(signature);

      await collectorDao.castVoteBySig(voter1.address, proposalId, Vote.yes, split.v, split.r, split.s);
      await expect(collectorDao.castVoteBySig(voter1.address, proposalId, Vote.yes, split.v, split.r, split.s))
        .to.be.revertedWithCustomError(collectorDao, "AlreadyVoted")
        .withArgs(voter1.address);
    });

    it("Block offchain generated signature in bulk if one is wrong", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      const split = ethers.utils.splitSignature(
        await voter1._signTypedData(domain(collectorDao.address), types, ballot(proposalId, Vote.yes))
      );
      const split2 = ethers.utils.splitSignature(
        await voter2._signTypedData(domain(collectorDao.address), types, ballot(proposalId, Vote.no))
      );
      /* vote no */
      const split3 = ethers.utils.splitSignature(
        await voter3._signTypedData(domain(collectorDao.address), types, ballot(proposalId, Vote.no))
      );
      const split4 = ethers.utils.splitSignature(
        await voter4._signTypedData(domain(collectorDao.address), types, ballot(proposalId, Vote.yes))
      );

      await expect(
        collectorDao.castVoteBySigBulk(
          [voter1.address, voter2.address, voter3.address, voter4.address],
          [proposalId, proposalId, proposalId, proposalId],
          [Vote.yes, Vote.no, Vote.yes, Vote.yes] /* vote yes for voter3 */,
          [split.v, split2.v, split3.v, split4.v],
          [split.r, split2.r, split3.r, split4.r],
          [split.s, split2.s, split3.s, split4.s]
        )
      )
        .to.revertedWithCustomError(collectorDao, "WrongSignature")
        .withArgs(voter3.address);
    });
  });

  describe("Execution", function () {
    it("Execute proposal to buy an nft from the marketplace", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER.mul(2)
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter4).voteProposal(proposalId, Vote.yes);

      await timeTravel(SECONDS_IN_DAY * 8);
      await collectorDao.connect(proposer).execute(targets, values, calldatas, toBytes32("Buy nft"));
      // balance starting with 7ether since 7 members
      // buying nftId = 1, that costs 1.5 ethers
      expect(await collectorDao.provider.getBalance(collectorDao.address)).to.be.equal(ethers.utils.parseEther("5.5"));
    });

    it('Emit "ProposalExecuted" and "NftBought" events after proposal creation', async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        2,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter4).voteProposal(proposalId, Vote.yes);

      await timeTravel(SECONDS_IN_DAY * 8);
      let executeTn = await collectorDao.connect(proposer).execute(targets, values, calldatas, toBytes32("Buy nft"));

      await executeTn.wait();
      await expect(executeTn).to.emit(collectorDao, "ProposalExecuted").withArgs(proposalId);
      await expect(executeTn)
        .to.emit(collectorDao, "NftBought")
        .withArgs(nftMarketplaceAddress, nftMarketplaceAddress, 2, ethers.utils.parseEther("0.5"));
    });

    it("Execute proposal to buy an nft from the marketplace without enough balance", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        4,
        ONE_ETHER.mul(10000)
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter4).voteProposal(proposalId, Vote.yes);

      await timeTravel(SECONDS_IN_DAY * 8);
      await expect(collectorDao.connect(proposer).execute(targets, values, calldatas, toBytes32("Buy nft")))
        .to.be.revertedWithCustomError(collectorDao, "NotEnoughBalance")
        .withArgs(ethers.utils.parseEther("7"), ethers.utils.parseEther("1000"));
    });

    it("Execute proposal to buy an nft from the marketplace but is greater than max price", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        3,
        ONE_ETHER.mul(3)
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter4).voteProposal(proposalId, Vote.yes);

      await timeTravel(SECONDS_IN_DAY * 8);
      await expect(collectorDao.connect(proposer).execute(targets, values, calldatas, toBytes32("Buy nft")))
        .to.be.revertedWithCustomError(collectorDao, "PriceTooHigh")
        .withArgs(ONE_ETHER.mul(3), ONE_ETHER.mul(4));
    });

    it("Execute proposal to buy an nft from the marketplace with error NftCannotBeBought", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        NFT_ID_MARKETPLACE_RETURN_FALSE,
        ONE_ETHER.mul(100)
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter4).voteProposal(proposalId, Vote.yes);

      await timeTravel(SECONDS_IN_DAY * 8);

      await expect(collectorDao.connect(proposer).execute(targets, values, calldatas, toBytes32("Buy nft")))
        .to.be.revertedWithCustomError(collectorDao, "NftCannotBeBought")
        .withArgs(nftMarketplaceAddress, nftMarketplaceAddress, 5, 0);
    });

    it("Execute proposal to buy an nft from the marketplace no specific error or message", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        NFT_ID_MARKETPLACE_REVERT_ERROR,
        ONE_ETHER.mul(100)
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter4).voteProposal(proposalId, Vote.yes);

      await timeTravel(SECONDS_IN_DAY * 8);

      await expect(collectorDao.connect(proposer).execute(targets, values, calldatas, toBytes32("Buy nft")))
        .to.be.revertedWithCustomError(collectorDao, "ExecutionError")
        .withArgs("Someting went wrong");
    });

    it("Block execute of a proposal if it's not a member", async function () {
      const { collectorDao, proposer, nonMember, nftMarketplaceAddress } = await loadFixture(setupFixture);

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");

      await expect(collectorDao.connect(nonMember).execute(targets, values, calldatas, toBytes32("Buy nft")))
        .to.be.revertedWithCustomError(collectorDao, "NotMember")
        .withArgs(nonMember.address);
    });

    it("Block execute of a proposal if it was aready executed", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER.mul(2)
      );
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter4).voteProposal(proposalId, Vote.yes);

      await timeTravel(SECONDS_IN_DAY * 8);

      await collectorDao.connect(voter1).execute(targets, values, calldatas, toBytes32("Buy nft"));
      await expect(collectorDao.connect(voter1).execute(targets, values, calldatas, toBytes32("Buy nft")))
        .to.be.revertedWithCustomError(collectorDao, "ProposalAlreadyExecuted")
        .withArgs(proposalId);
    });

    it("Block execute of a proposal if it's expired", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      await timeTravel(SECONDS_IN_DAY * 8);

      await expect(collectorDao.connect(voter1).execute(targets, values, calldatas, toBytes32("Buy nft")))
        .to.be.revertedWithCustomError(collectorDao, "ProposalCannotBeExecuted")
        .withArgs(ProposalState.Expired);
    });

    it("Block execute of a proposal if it's failed", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.no);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.no);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.no);
      await collectorDao.connect(voter4).voteProposal(proposalId, Vote.yes);
      await timeTravel(SECONDS_IN_DAY * 8);

      await expect(collectorDao.connect(voter1).execute(targets, values, calldatas, toBytes32("Buy nft")))
        .to.be.revertedWithCustomError(collectorDao, "ProposalCannotBeExecuted")
        .withArgs(ProposalState.Failed);
    });

    it("Block buying nft if is not contract calling", async function () {
      const { collectorDao, proposer, voter1, voter2, voter3, voter4, nftMarketplaceAddress } = await loadFixture(
        setupFixture
      );
      await expect(
        collectorDao.connect(voter1).buyNftFromMarketplace(nftMarketplaceAddress, nftMarketplaceAddress, 1, ONE_ETHER)
      )
        .to.be.revertedWithCustomError(collectorDao, "OnlyContractCanBuy")
        .withArgs(voter1.address);
    });
  });

  describe("Signature", function () {
    it("Signature is verified correctly", async function () {
      const { collectorDao, proposer, voter1, nftMarketplaceAddress } = await loadFixture(setupFixture);

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      const signature = await voter1._signTypedData(domain(collectorDao.address), types, ballot(proposalId, Vote.yes));
      const split = ethers.utils.splitSignature(signature);

      expect(await collectorDao.verifySignature(voter1.address, proposalId, Vote.yes, split.v, split.r, split.s)).to.be
        .true;
    });

    it("Revert if signature is wrong", async function () {
      const { collectorDao, proposer, voter1, nftMarketplaceAddress } = await loadFixture(setupFixture);

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      const signature = await voter1._signTypedData(
        domain(collectorDao.address),
        types,
        ballot(proposalId, Vote.yes) // verify with real proposalId
      );
      const split = ethers.utils.splitSignature(signature);

      // give a random proposalId
      await expect(
        collectorDao.verifySignature(voter1.address, BigNumber.from(123123123), Vote.yes, split.v, split.r, split.s)
      )
        .to.be.revertedWithCustomError(collectorDao, "WrongSignature")
        .withArgs(voter1.address);
    });
  });

  describe("Proposal state", function () {
    it("Retrieves an active proposal", async () => {
      const { collectorDao, proposer, nftMarketplaceAddress } = await loadFixture(setupFixture);
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));

      expect(await collectorDao.state(proposalId)).to.be.equals(ProposalState.Active);
    });

    it("Retrieves an expired proposal", async () => {
      const { collectorDao, proposer, nftMarketplaceAddress } = await loadFixture(setupFixture);
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));
      await timeTravel(SECONDS_IN_DAY * 8);

      expect(await collectorDao.state(proposalId)).to.be.equals(ProposalState.Expired);
    });

    it("Retrieves a successful proposal", async () => {
      const { collectorDao, proposer, nftMarketplaceAddress, voter1, voter2, voter3, voter4 } = await loadFixture(
        setupFixture
      );
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));
      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter4).voteProposal(proposalId, Vote.no);
      await timeTravel(SECONDS_IN_DAY * 8);

      expect(await collectorDao.state(proposalId)).to.be.equals(ProposalState.Successful);
    });

    it("Retrieves a failed proposal", async () => {
      const { collectorDao, proposer, nftMarketplaceAddress, voter1, voter2, voter3, voter4 } = await loadFixture(
        setupFixture
      );
      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));
      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.no);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.no);
      await collectorDao.connect(voter4).voteProposal(proposalId, Vote.no);
      await timeTravel(SECONDS_IN_DAY * 8);

      expect(await collectorDao.state(proposalId)).to.be.equals(ProposalState.Failed);
    });

    it("Retrieves an executed failed proposal", async () => {
      const { collectorDao, proposer, nftMarketplaceAddress, voter1, voter2, voter3, voter4 } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER.mul(2)
      );

      await collectorDao.connect(proposer).createProposal(targets, values, calldatas, "Buy nft");
      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));
      await collectorDao.connect(voter1).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter2).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter3).voteProposal(proposalId, Vote.yes);
      await collectorDao.connect(voter4).voteProposal(proposalId, Vote.no);
      await timeTravel(SECONDS_IN_DAY * 8);

      await collectorDao.connect(proposer).execute(targets, values, calldatas, toBytes32("Buy nft"));
      expect(await collectorDao.state(proposalId)).to.be.equals(ProposalState.Executed);
    });

    it("Proposal does not exists", async () => {
      const { collectorDao, proposer, nftMarketplaceAddress, voter1, voter2, voter3, voter4 } = await loadFixture(
        setupFixture
      );

      const { targets, values, calldatas } = generateNftMarketplaceData(
        collectorDao.address,
        nftMarketplaceAddress,
        1,
        ONE_ETHER
      );

      const proposalId = await collectorDao.hashProposal(targets, values, calldatas, toBytes32("Buy nft"));
      expect(await collectorDao.state(proposalId)).to.be.equals(ProposalState.NotExists);
    });
  });

  describe("ERC721", function () {
    it("Should be ERC721.safeTransferFrom compliant", async function () {
      const CollectorDao = await ethers.getContractFactory("CollectorDao");
      const collectorDao: CollectorDao = (await CollectorDao.deploy()) as CollectorDao;
      await collectorDao.deployed();
      expect(collectorDao.onERC721Received).to.exist;
    });
  });
});
