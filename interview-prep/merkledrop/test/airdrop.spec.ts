import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import hre from "hardhat";
import { Airdrop, ERC20, MacroToken } from "../typechain-types";

const provider = ethers.provider;
let account1: SignerWithAddress;
let account2: SignerWithAddress;
let rest: SignerWithAddress[];

let macroToken: MacroToken;
let airdrop: Airdrop;
let merkleRoot: string;
let proof: string[];
let leaves: string[];
let parent1: string;
let parent2: string;

function initialHashListToken(address: string, amount: BigNumber) {
  return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [address, amount]));
}

describe("Airdrop", function () {
  before(async () => {
    [account1, account2, ...rest] = await ethers.getSigners();

    const addresses = {
      [account2.address]: ethers.utils.parseEther("1"),
      [rest[0].address]: ethers.utils.parseEther("1"),
      [rest[1].address]: ethers.utils.parseEther("1"),
      [rest[2].address]: ethers.utils.parseEther("1"),
    };

    leaves = Object.entries(addresses).map(([key, value]) => initialHashListToken(key, value));
    parent1 = ethers.utils.keccak256(ethers.utils.hexConcat([leaves[0], leaves[1]]));
    parent2 = ethers.utils.keccak256(ethers.utils.hexConcat([leaves[2], leaves[3]]));
    merkleRoot = ethers.utils.keccak256(ethers.utils.hexConcat([parent1, parent2]));
  });

  beforeEach(async () => {
    macroToken = (await (await ethers.getContractFactory("MacroToken")).deploy("Macro Token", "MACRO")) as MacroToken;
    await macroToken.deployed();

    airdrop = await (
      await ethers.getContractFactory("Airdrop")
    ).deploy(merkleRoot, account1.address, macroToken.address);
    await airdrop.deployed();
    await macroToken.mint(airdrop.address, ethers.utils.parseEther("100"));
  });

  describe("setup and disabling ECDSA", () => {
    it("should deploy correctly", async () => {
      // if the beforeEach succeeded, then this succeeds
      expect(airdrop.address).not.to.be.equal(0);
      expect(airdrop.address).not.to.be.equal(0x0);
    });

    it("should disable ECDSA verification", async () => {
      // first try with non-owner user
      await expect(airdrop.connect(account2).disableECDSAVerification()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      // now try with owner
      await expect(airdrop.disableECDSAVerification()).to.emit(airdrop, "ECDSADisabled").withArgs(account1.address);
    });
  });

  describe("Merkle claiming", () => {
    it("Should transfer token if leaf 1 is part of the tree", async () => {
      proof = [leaves[1], parent2];
      await airdrop.merkleClaim(proof, account2.address, ethers.utils.parseEther("1"));

      expect(await airdrop.alreadyClaimed(account2.address)).to.be.true;
      expect(await macroToken.balanceOf(account2.address)).to.be.equal(ethers.utils.parseEther("1"));
      expect(await macroToken.balanceOf(airdrop.address)).to.be.equal(ethers.utils.parseEther("99"));
    });

    it("Should transfer token if leaf 2 is part of the tree", async () => {
      proof = [leaves[0], parent2];
      await airdrop.merkleClaim(proof, rest[0].address, ethers.utils.parseEther("1"));

      expect(await airdrop.alreadyClaimed(rest[0].address)).to.be.true;
      expect(await macroToken.balanceOf(rest[0].address)).to.be.equal(ethers.utils.parseEther("1"));
      expect(await macroToken.balanceOf(airdrop.address)).to.be.equal(ethers.utils.parseEther("99"));
    });

    it("Should transfer token if leaf 3 is part of the tree", async () => {
      proof = [leaves[3], parent1];
      await airdrop.merkleClaim(proof, rest[1].address, ethers.utils.parseEther("1"));

      expect(await airdrop.alreadyClaimed(rest[1].address)).to.be.true;
      expect(await macroToken.balanceOf(rest[1].address)).to.be.equal(ethers.utils.parseEther("1"));
      expect(await macroToken.balanceOf(airdrop.address)).to.be.equal(ethers.utils.parseEther("99"));
    });

    it("Should transfer token if leaf 4 is part of the tree", async () => {
      proof = [leaves[2], parent1];
      await airdrop.merkleClaim(proof, rest[2].address, ethers.utils.parseEther("1"));

      expect(await airdrop.alreadyClaimed(rest[2].address)).to.be.true;
      expect(await macroToken.balanceOf(rest[2].address)).to.be.equal(ethers.utils.parseEther("1"));
      expect(await macroToken.balanceOf(airdrop.address)).to.be.equal(ethers.utils.parseEther("99"));
    });

    it("Block transfer token if recipient and amount are part of the tree", async () => {
      proof = [leaves[1], parent2];
      await expect(airdrop.merkleClaim(proof, rest[10].address, ethers.utils.parseEther("100"))).to.be.revertedWith(
        "Must be part of the tree"
      );

      expect(await airdrop.alreadyClaimed(rest[10].address)).to.be.false;
      expect(await macroToken.balanceOf(rest[10].address)).to.be.equal(ethers.utils.parseEther("0"));
      expect(await macroToken.balanceOf(airdrop.address)).to.be.equal(ethers.utils.parseEther("100"));
    });
  });

  describe("Signature claiming", () => {
    it("Should tranfer token if message is signed by airdrop signer", async () => {
      const signature = await account1._signTypedData(
        {
          name: "Airdrop",
          version: "v1",
          chainId: hre.network.config.chainId, // Hardhat
          verifyingContract: airdrop.address,
        },
        {
          Claim: [
            { name: "claimer", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        },
        {
          claimer: account2.address,
          amount: ethers.utils.parseEther("1"),
        }
      );

      await airdrop.signatureClaim(signature, account2.address, ethers.utils.parseEther("1"));
      expect(await airdrop.alreadyClaimed(account2.address)).to.be.true;
      expect(await macroToken.balanceOf(account2.address)).to.be.equal(ethers.utils.parseEther("1"));
      expect(await macroToken.balanceOf(airdrop.address)).to.be.equal(ethers.utils.parseEther("99"));
    });

    it("Block tranfer token if message is not signed by airdrop signer", async () => {
      const signature = await rest[10]._signTypedData(
        {
          name: "Airdrop",
          version: "v1",
          chainId: hre.network.config.chainId, // Hardhat
          verifyingContract: airdrop.address,
        },
        {
          Claim: [
            { name: "claimer", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        },
        {
          claimer: rest[10].address,
          amount: ethers.utils.parseEther("1"),
        }
      );

      await expect(
        airdrop.signatureClaim(signature, rest[10].address, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("not signed by contract signer");
      expect(await airdrop.alreadyClaimed(rest[10].address)).to.be.false;
      expect(await macroToken.balanceOf(rest[10].address)).to.be.equal(ethers.utils.parseEther("0"));
      expect(await macroToken.balanceOf(airdrop.address)).to.be.equal(ethers.utils.parseEther("100"));
    });
  });
});
