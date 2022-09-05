import { useState, FormEvent, useEffect } from "react";
import { ethers } from "ethers";

import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { spaceCoinIcoContract } from "../contracts/SpaceCoinIco";
import { formatError } from "../helpers/formatError";

const Contribute = () => {
  const [amount, setAmount] = useState("");
  const [amountRaised, setAmountRaised] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [icoContract, setIcoContract] = useState<any>();

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
    } catch (error: any) {
      setError(formatError(error, icoContract));
    }
  };

  useEffect(() => {
    if (icoContract) {
      getFundsRaised();
      icoContract.on("Contribute", getFundsRaised);
    }
    return () => {
      if (icoContract) {
        icoContract.off("Contribute", getFundsRaised);
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
      <Typography variant="h5" gutterBottom sx={{ p: 2, textAlign: "center" }}>
        Total raised: {amountRaised} ETH
      </Typography>
      <form onSubmit={submit} noValidate autoComplete="off">
        <Box display={"flex"} alignContent={"center"} component="div" sx={{ mb: 5 }}>
          <TextField
            disabled={isSubmitting}
            placeholder="Amount"
            type="number"
            value={amount}
            fullWidth
            onChange={(e) => setAmount(e.target.value)}
            label="Contribution"
            variant="outlined"
          />
          <Button disabled={isSubmitting} type="submit" variant="outlined" sx={{ width: "125px", marginLeft: "5px" }}>
            Send
          </Button>
        </Box>
      </form>
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
