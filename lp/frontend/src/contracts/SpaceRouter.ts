import { ethers } from "ethers";
import abi from "./SpaceRouter.json";
import { providers } from "ethers";

import { SpaceRouter } from "../typechain-types";

export const spaceRouterContract = (web3Provider: providers.ExternalProvider): SpaceRouter => {
  const contractAddress =
    process.env.REACT_APP_ENV === "dev"
      ? process.env.REACT_APP_LOCAL_CONTRACT_ROUTER || ""
      : process.env.REACT_APP_RINKEBY_CONTRACT_ROUTER || "";

  const contractABI = abi.abi;

  const provider = new ethers.providers.Web3Provider(web3Provider);
  const signer = provider.getSigner();
  return new ethers.Contract(contractAddress, contractABI, signer) as SpaceRouter;
};
