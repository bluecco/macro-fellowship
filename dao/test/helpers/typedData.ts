import hre from "hardhat";
import { BigNumber } from "ethers";
import { Vote } from "./enums";

export const domain = (verifyingContract: string) => ({
  name: "CollectorsDAO",
  chainId: hre.network.config.chainId, // Hardhat
  verifyingContract: verifyingContract,
});

export const types = {
  Vote: [
    { name: "proposalId", type: "uint256" },
    { name: "vote", type: "uint8" },
  ],
};

export const ballot = (proposalId: BigNumber, vote: Vote) => ({
  proposalId,
  vote,
});
