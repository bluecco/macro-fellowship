import { useEffect, useState } from "react";
import { ethers, BigNumber } from "ethers";
import Box from "@mui/material/Box";
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
    <>
      <Box sx={{ mt: 3, mb: 1, color: "white" }}>SPC Distributed</Box>
      <Box sx={{ mb: 3 }}>
        <Typography color="white" variant="h4" gutterBottom>
          {currentSupply} of {icoSupply}
        </Typography>
      </Box>
    </>
  );
};

export { TokenSupply };
