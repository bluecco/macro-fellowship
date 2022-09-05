import { ethers } from "ethers";
import abi from "./SpaceCoin.json";
import { providers } from "ethers";

export const spaceCoinTokenContract = (web3Provider: providers.ExternalProvider) => {
  const contractAddress =
    process.env.REACT_APP_ENV === "dev"
      ? process.env.REACT_APP_LOCAL_CONTRACT_TOKEN || ""
      : process.env.REACT_APP_RINKEBY_CONTRACT_TOKEN || "";

  const contractABI = abi.abi;

  const provider = new ethers.providers.Web3Provider(web3Provider);
  const signer = provider.getSigner();
  return new ethers.Contract(contractAddress, contractABI, signer);
};
