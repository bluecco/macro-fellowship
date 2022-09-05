import { FC, useState, useEffect } from "react";
import { ethers } from "ethers";

import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";

import { TokenSupply } from "./TokenSupply";

import { spaceCoinIcoContract } from "../contracts/SpaceCoinIco";
import { spaceCoinTokenContract } from "../contracts/SpaceCoin";
import { formatError } from "../helpers/formatError";

enum IcoPhase {
  SEED,
  GENERAL,
  OPEN,
}

const IcoPhaseLabels = {
  [IcoPhase.SEED]: "Seed phase",
  [IcoPhase.GENERAL]: "General phase",
  [IcoPhase.OPEN]: "Open phase",
};

const Balances: FC<{ address: string }> = ({ address }) => {
  const [tokensOwned, setTokensOwned] = useState("");
  const [tokensClaimable, setTokensClaimable] = useState("");
  const [contribution, setContribution] = useState("");
  const [currentPhase, setCurrentPhase] = useState<IcoPhase>(IcoPhase.SEED);
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  const { ethereum } = window;

  const [icoContract, setIcoContract] = useState<any>();
  const [tokenContract, setTokenContract] = useState<any>();

  const getBalance = async () => {
    try {
      if (ethereum && icoContract) {
        const contributionsMade = await icoContract.addressToContribution(address);
        setContribution(ethers.utils.formatEther(contributionsMade));

        const toClaim = await icoContract.addressToTokenDistribute(address);
        setTokensClaimable(ethers.utils.formatEther(toClaim));

        setCurrentPhase(await icoContract.currentPhase());
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error: any) {
      setError(formatError(error, icoContract));
    }
    try {
      if (ethereum && tokenContract) {
        setTokensOwned(ethers.utils.formatEther(await tokenContract.balanceOf(address)));
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

  const phaseAdvanced = async (icoPhase: IcoPhase) => {
    setCurrentPhase((prevState) => prevState + 1);
  };

  const tokensClaimed = async (_: string, amount: string) => {
    getBalance();
  };

  useEffect(() => {
    if (icoContract) {
      getBalance();
      icoContract.on("Contribute", updateContribution);
      icoContract.on("PhaseAdvanced", phaseAdvanced);
      icoContract.on("TokensClaimed", tokensClaimed);
    }
    return () => {
      if (icoContract) {
        icoContract.off("Contribute", updateContribution);
        icoContract.off("PhaseAdvanced", phaseAdvanced);
        icoContract.off("TokensClaimed", tokensClaimed);
      }
    };
  }, [icoContract]);

  useEffect(() => {
    getBalance();
  }, [address]);

  useEffect(() => {
    const { ethereum } = window;

    if (ethereum) {
      setIcoContract(spaceCoinIcoContract(ethereum));
      setTokenContract(spaceCoinTokenContract(ethereum));
    } else {
      console.log("Ethereum object not found");
    }
  }, []);

  const handleClose = () => {
    setError(null);
  };

  return (
    <>
      <Typography color="white" variant="h4" gutterBottom sx={{ mt: 5 }}>
        ICO is in {IcoPhaseLabels[currentPhase]}
        <TokenSupply />
      </Typography>
      <Box sx={{ flexGrow: 1 }}>
        <Grid container spacing={5}>
          <Grid item xs={4}>
            <Box sx={{ mt: 5, mb: 1, color: "white" }}>Claimable SPC</Box>
            <Box sx={{ mb: 5 }}>
              <Typography color="white" variant="h4" gutterBottom>
                {tokensClaimable}
                <Button
                  disabled={isClaiming}
                  variant="contained"
                  color="warning"
                  sx={{ width: "125px", marginLeft: "30px", color: "white" }}
                  onClick={claimTokens}
                >
                  Claim
                </Button>
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={4}>
            <Box sx={{ mt: 5, mb: 1, color: "white" }}>Owned SPC</Box>
            <Box sx={{ mb: 5 }}>
              <Typography color="white" variant="h4" gutterBottom>
                {tokensOwned}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={4}>
            <Box sx={{ mt: 5, mb: 1, color: "white" }}>ETH contributed</Box>
            <Box sx={{ mb: 5 }}>
              <Typography color="white" variant="h4" gutterBottom>
                {contribution}
              </Typography>
            </Box>
          </Grid>
        </Grid>
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
