import { ethers } from "ethers";
import abi from "./LiquidityPool.json";
import { providers } from "ethers";

import { LiquidityPool } from "../typechain-types";

const contractAddress =
  process.env.REACT_APP_ENV === "dev"
    ? process.env.REACT_APP_LOCAL_CONTRACT_LP || ""
    : process.env.REACT_APP_RINKEBY_CONTRACT_LP || "";

export const liquidityPoolContract = (web3Provider: providers.ExternalProvider): LiquidityPool => {
  const contractABI = abi.abi;

  const provider = new ethers.providers.Web3Provider(web3Provider);
  const signer = provider.getSigner();
  return new ethers.Contract(contractAddress, contractABI, signer) as LiquidityPool;
};
