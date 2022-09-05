import { ethers } from "ethers";
import abi from "./SpaceCoinIco.json";
import { providers } from "ethers";

import { SpaceCoinIco } from "../typechain-types";

export const spaceCoinIcoContract = (web3Provider: providers.ExternalProvider): SpaceCoinIco => {
  const contractAddress =
    process.env.REACT_APP_ENV === "dev"
      ? process.env.REACT_APP_LOCAL_CONTRACT_ICO || ""
      : process.env.REACT_APP_RINKEBY_CONTRACT_ICO || "";

  const contractABI = abi.abi;

  const provider = new ethers.providers.Web3Provider(web3Provider);
  const signer = provider.getSigner();
  return new ethers.Contract(contractAddress, contractABI, signer) as SpaceCoinIco;
};
