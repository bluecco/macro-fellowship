import { useEffect, useState } from "react";
import { ethers, BigNumber } from "ethers";

import Typography from "@mui/material/Typography";
import { spaceCoinTokenContract } from "../contracts/SpaceCoin";
import { spaceCoinIcoContract } from "../contracts/SpaceCoinIco";

const TokenSupply = () => {
  const [currentSupply, setCurrentSupply] = useState("");
  const [icoSupply, setIcoSupply] = useState("");
  const [icoContract, setIcoContract] = useState<any>();
  const [tokenContract, setTokenContract] = useState<any>();

  const getSupply = async () => {
    const current: BigNumber = await tokenContract.balanceOf(icoContract.address);
    const icoSupply: BigNumber = await tokenContract.ICO_SUPPLY();

    const distributed = ethers.utils.parseEther(`${icoSupply}`).sub(current);
    setIcoSupply(`${icoSupply.toNumber()}`);
    setCurrentSupply(ethers.utils.formatEther(distributed));
  };

  useEffect(() => {
    const { ethereum } = window;

    if (ethereum) {
      setIcoContract(spaceCoinIcoContract(ethereum));
      setTokenContract(spaceCoinTokenContract(ethereum));
    } else {
      console.log("Ethereum object not found");
    }
  }, []);

  useEffect(() => {
    if (icoContract && tokenContract) {
      getSupply();
      icoContract.on("Contribute", getSupply);
      icoContract.on("TokensClaimed", getSupply);
    }
    return () => {
      if (icoContract) {
        icoContract.off("Contribute", getSupply);
        icoContract.off("TokensClaimed", getSupply);
      }
    };
  }, [icoContract]);

  return (
    <Typography variant="h6" gutterBottom>
      SPC Distributed: {currentSupply} of {icoSupply}
    </Typography>
  );
};

export { TokenSupply };
