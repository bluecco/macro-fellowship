import { FC, FormEvent, useState, useEffect } from "react";
import { ethers } from "ethers";

import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { Balances } from "./Balances";
import { TokenSupply } from "./TokenSupply";

import { spaceCoinIcoContract } from "../contracts/SpaceCoinIco";
import { formatError } from "../helpers/formatError";

enum IcoPhase {
  SEED,
  GENERAL,
  OPEN,
}

const IcoPhaseLabels = {
  [IcoPhase.SEED]: "SEED",
  [IcoPhase.GENERAL]: "GENERAL",
  [IcoPhase.OPEN]: "OPEN",
};

const Contribute: FC<{ address: string }> = ({ address }) => {
  const [amount, setAmount] = useState("");
  const [amountRaised, setAmountRaised] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [icoContract, setIcoContract] = useState<any>();
  const [currentPhase, setCurrentPhase] = useState<IcoPhase>(IcoPhase.SEED);

  useEffect(() => {
    const { ethereum } = window;

    if (ethereum) {
      setIcoContract(spaceCoinIcoContract(ethereum));
    } else {
      console.log("Ethereum object not found");
    }
  }, []);

  const getFundsRaised = async () => {
    try {
      const contributionsMade = await icoContract.amountRaised();
      setAmountRaised(ethers.utils.formatEther(contributionsMade));
      setCurrentPhase(await icoContract.currentPhase());
    } catch (error: any) {
      setError(formatError(error, icoContract));
    }
  };

  const phaseAdvanced = async (icoPhase: IcoPhase) => {
    setCurrentPhase((prevState) => prevState + 1);
  };

  useEffect(() => {
    if (icoContract) {
      getFundsRaised();
      icoContract.on("Contribute", getFundsRaised);
      icoContract.on("PhaseAdvanced", phaseAdvanced);
    }
    return () => {
      if (icoContract) {
        icoContract.off("Contribute", getFundsRaised);
        icoContract.off("PhaseAdvanced", phaseAdvanced);
      }
    };
  }, [icoContract]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { ethereum } = window;
    const contract = spaceCoinIcoContract(ethereum);

    try {
      setIsSubmitting(true);
      const txn = await contract.contribute({ value: ethers.utils.parseEther(amount) });
      await txn.wait();
      setIsSubmitting(false);
    } catch (error: any) {
      setError(formatError(error, contract));
    } finally {
      setIsSubmitting(false);
    }
    setAmount("");
  };

  const handleClose = () => {
    setError(null);
  };

  return (
    <>
      <Box display={"flex"} alignItems="center">
        <Typography variant="h6" gutterBottom sx={{ mr: 2, pt: 2 }}>
          Total raised: {amountRaised} ETH
        </Typography>
        <form onSubmit={submit} noValidate autoComplete="off">
          <Box display={"flex"} alignContent={"center"} component="div">
            <TextField
              disabled={isSubmitting}
              placeholder="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              label="Contribute ETH"
              variant="outlined"
            />
            <Button disabled={isSubmitting} type="submit" variant="outlined" sx={{ width: "125px", marginLeft: "5px" }}>
              Send
            </Button>
          </Box>
        </form>
        <div style={{ display: "flex", flex: 1 }} />
        <TokenSupply />
      </Box>
      <Box display={"flex"} alignItems="center" justifyContent="space-between" sx={{ mt: 1, mb: 1 }}>
        <Balances address={address} phase={IcoPhaseLabels[currentPhase]} />
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

export { Contribute };
