import { FC, useState, useEffect } from "react";
import { ethers } from "ethers";

import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";

import { spaceCoinIcoContract } from "../contracts/SpaceCoinIco";
import { spaceCoinTokenContract } from "../contracts/SpaceCoin";
import { spaceRouterContract } from "../contracts/SpaceRouter";
import { formatError } from "../helpers/formatError";

import { SpaceCoin, SpaceCoinIco, LiquidityPool } from "../typechain-types";
import { liquidityPoolContract } from "../contracts/LiquidityPool";

const Balances: FC<{ address: string; phase: string }> = ({ address, phase }) => {
  const [tokensOwned, setTokensOwned] = useState("");
  const [tokensClaimable, setTokensClaimable] = useState("");
  const [contribution, setContribution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  const { ethereum } = window;

  const [icoContract, setIcoContract] = useState<SpaceCoinIco>();
  const [tokenContract, setTokenContract] = useState<SpaceCoin>();
  const [lpRouterContract, setLpRouterContract] = useState<LiquidityPool>();

  const getBalance = async () => {
    try {
      if (ethereum && icoContract) {
        const contributionsMade = await icoContract.addressToContribution(address);
        setContribution(ethers.utils.formatEther(contributionsMade));

        const toClaim = await icoContract.addressToTokenDistribute(address);
        setTokensClaimable(ethers.utils.formatEther(toClaim));
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error: any) {
      setError(formatError(error, icoContract));
    }
    try {
      if (ethereum && tokenContract) {
        const balance = await tokenContract.balanceOf(address);
        setTokensOwned(ethers.utils.formatEther(balance.sub(balance.mod(1e14))));
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error: any) {
      setError(formatError(error, tokenContract));
    }
  };

  const claimTokens = async () => {
    try {
      setIsClaiming(true);
      if (ethereum && icoContract) {
        await icoContract.claimTokens();
        getBalance();
      }
    } catch (error: any) {
      setError(formatError(error, icoContract));
    } finally {
      setIsClaiming(false);
    }
  };

  const updateContribution = async (_: string, amount: string) => {
    getBalance();
  };

  const tokensClaimed = async (_: string, amount: string) => {
    getBalance();
  };

  useEffect(() => {
    if (icoContract && lpRouterContract) {
      getBalance();
      icoContract.on("Contribute", updateContribution);
      icoContract.on("TokensClaimed", tokensClaimed);
      lpRouterContract.on("Swapped", tokensClaimed);
    }
    return () => {
      if (icoContract && lpRouterContract) {
        icoContract.off("Contribute", updateContribution);
        icoContract.off("TokensClaimed", tokensClaimed);
        lpRouterContract.off("Swapped", tokensClaimed);
      }
    };
  }, [icoContract, spaceRouterContract]);

  useEffect(() => {
    getBalance();
  }, [address]);

  useEffect(() => {
    const { ethereum } = window;

    if (ethereum) {
      setIcoContract(spaceCoinIcoContract(ethereum));
      setTokenContract(spaceCoinTokenContract(ethereum));
      setLpRouterContract(liquidityPoolContract(ethereum));
    } else {
      console.log("Ethereum object not found");
    }
  }, []);

  const handleClose = () => setError(null);

  return (
    <>
      <Box display="flex" flex={1} justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          Phase {phase}
        </Typography>
        <Box display="flex">
          <Box display="flex" flexDirection="column">
            <Box sx={{ mb: 1 }}>Claimable SPC</Box>
            <Box display="flex">
              <Typography variant="h6" gutterBottom>
                {tokensClaimable}
                <Button
                  disabled={isClaiming}
                  variant="contained"
                  color="warning"
                  sx={{ width: "125px", marginLeft: "30px" }}
                  onClick={claimTokens}
                >
                  Claim
                </Button>
              </Typography>
            </Box>
          </Box>

          <Box display="flex" flexDirection="column" sx={{ ml: 10, mr: 10 }}>
            <Box sx={{ mb: 1 }}>Owned SPC</Box>
            <Box display="flex">
              <Typography variant="h6" gutterBottom>
                {tokensOwned}
              </Typography>
            </Box>
          </Box>

          <Box display="flex" flexDirection="column">
            <Box sx={{ mb: 1 }}>ETH contributed</Box>
            <Box display="flex" justifyContent="flex-end">
              <Typography variant="h6" gutterBottom>
                {contribution}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
      <Snackbar
        color="error"
        autoHideDuration={5000}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={!!error}
        onClose={handleClose}
      >
        <Alert onClose={handleClose} severity="error" sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};

export { Balances };
