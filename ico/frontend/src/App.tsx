import { useState, useEffect } from "react";
import { spaceCoinIcoContract } from "./contracts/SpaceCoinIco";

import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import { Balances } from "./components/Balances";
import { Contribute } from "./components/Contribute";
import { formatError } from "./helpers/formatError";

import "./App.css";

function App() {
  const [currentAccount, setCurrentAccount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [icoContract, setIcoContract] = useState<any>();

  useEffect(() => {
    if (icoContract) {
      getPause();
      icoContract.on("Paused", updatePause);
    }
    return () => {
      if (icoContract) {
        icoContract.off("Paused", updatePause);
      }
    };
  }, [icoContract]);

  useEffect(() => {
    checkIfWalletIsConnected();

    const { ethereum } = window;
    setIcoContract(spaceCoinIcoContract(ethereum))

  }, []);

  const checkIfWalletIsConnected = async () => {
    try {
      const { ethereum } = window;

      if (!ethereum) {
        console.log("Make sure you have MetaMask!");
        return;
      } else {
        const accounts = await ethereum.request({ method: "eth_accounts" });
        window.ethereum.on("accountsChanged", (accts: any) => {
          setCurrentAccount(accts[0]);
        });

        if (accounts.length !== 0) {
          const account = accounts[0];
          console.log("Found an authorized account:", account);
          setCurrentAccount(account);
        } else {
          console.log("No authorized account found");
        }
      }
    } catch (error) {
      setError("Something went wrong while retrieving metamask accounts");
    }
  };

  const connectWallet = async () => {
    try {
      const { ethereum } = window;

      if (!ethereum) {
        alert("Get MetaMask!");
        return;
      }
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      console.log("Connected", accounts[0]);
      setCurrentAccount(accounts[0]);
    } catch (error: any) {
      setError(error);
    }
  };

  const updatePause = async (newState: boolean) => {
    try {
      setIsPaused(newState)
    } catch (error: any) {
      setError(formatError(error, icoContract));
    } finally {
      setIsLoading(false);
    }
  };

  const getPause = async () => {
    try {
      setIsLoading(true);
      setIsPaused(await icoContract.paused());
    } catch (error: any) {
      setError(formatError(error, icoContract));
    } finally {
      setIsLoading(false);
    }
  };

  const nextPhase = async () => {
    const { ethereum } = window;
    const contract = spaceCoinIcoContract(ethereum);
    try {
      setIsLoading(true);
      const tx = await contract.phaseAdvance();
      await tx.wait();
    } catch (error: any) {
      setError(formatError(error, contract));
    } finally {
      setIsLoading(false);
    }
  };

  const pauseResume = async () => {
    const { ethereum } = window;
    const contract = spaceCoinIcoContract(ethereum);
    try {
      setIsLoading(true);
      const tx = await contract.setPaused(!isPaused);
      await tx.wait();
    } catch (error: any) {
      setError(formatError(error, contract));
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentAccount) {
    return (
      <div className="App-background">
        <div className="App-container" style={{ justifyContent: "center", alignItems: "center" }}>
          <Button color="warning" variant="contained" sx={{ width: "250px" }} onClick={connectWallet}>
            Connect your wallet
          </Button>
        </div>
      </div>
    );
  }

  const handleClose = () => {
    setError(null);
  };

  return (
    <div className="App-background">
      <div className="App-container">
        <Typography color="white" variant="h2" gutterBottom sx={{ pt: 2, textAlign: "center" }}>
          SPC ICO
        </Typography>
        <Paper elevation={4} sx={{ p: 5 }} component="div">
          <Contribute />
        </Paper>
        <Balances address={currentAccount} />
        <div style={{ display: "flex", flex: 1 }} />
      </div>
      <Paper
        elevation={0}
        sx={{
          pt: 3,
          pb: 3,
          position: "fixed",
          bottom: 0,
          width: "100%",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Button disabled={isLoading} variant="outlined" sx={{ mr: 3 }} onClick={pauseResume}>
          {isPaused ? "Resume" : "Pause"}
        </Button>
        <Button disabled={isLoading} variant="outlined" sx={{ mr: 3 }} onClick={nextPhase}>
          Next phase
        </Button>
      </Paper>
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
    </div>
  );
}

export default App;
