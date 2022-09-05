import { FC, FormEvent, useState, useEffect } from "react";
import { ethers, BigNumber } from "ethers";

import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { liquidityPoolContract } from "../../contracts/LiquidityPool";
import { spaceRouterContract } from "../../contracts/SpaceRouter";
import { spaceCoinTokenContract } from "../../contracts/SpaceCoin";
import { formatError } from "../../helpers/formatError";

import { LiquidityPool as LPContract, SpaceRouter } from "../../typechain-types";

const DepositLiquidity: FC<{ address: string }> = ({ address }) => {
  const [ethIn, setEthIn] = useState("");
  const [spcIn, setSpcIn] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lpContract, setLpContract] = useState<LPContract | null>();
  const [spcRouterContract, setSpcRouterContract] = useState<SpaceRouter | null>();
  const [ethReserve, setEthReserve] = useState<BigNumber>(BigNumber.from(0));
  const [spcReserve, setSpcReserve] = useState<BigNumber>(BigNumber.from(0));
  const { ethereum } = window;

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    const spaceCoinContract = spaceCoinTokenContract(ethereum);

    try {
      if (spcRouterContract) {
        setIsSubmitting(true);
        const allowanceTx = await spaceCoinContract.increaseAllowance(
          spcRouterContract.address,
          ethers.utils.parseEther(spcIn)
        );
        await allowanceTx.wait();

        const txn = await spcRouterContract.deposit(ethers.utils.parseEther(spcIn), {
          value: ethers.utils.parseEther(ethIn),
        });
        await txn.wait();
      }

      setIsSubmitting(false);
    } catch (error: any) {
      console.log(error);
      setError(formatError(error, spaceCoinContract));
    } finally {
      setIsSubmitting(false);
    }
    setEthIn("");
    setSpcIn("");
  };

  const getReserves = async () => {
    try {
      if (ethereum && lpContract) {
        let [ethR, spcR]: any = await lpContract?.getReserves();
        setEthReserve(ethR);
        setSpcReserve(spcR);
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error: any) {
      setError(formatError(error, lpContract));
    }
  };

  useEffect(() => {
    const { ethereum } = window;

    if (ethereum) {
      setSpcRouterContract(spaceRouterContract(ethereum));
      setLpContract(liquidityPoolContract(ethereum));
    } else {
      console.log("Ethereum object not found");
    }
  }, []);

  useEffect(() => {
    if (lpContract) {
      getReserves();
      lpContract.on("Minted", getReserves);
      lpContract.on("Burned", getReserves);
      lpContract.on("Swapped", getReserves);
    }
    return () => {
      if (lpContract) {
        lpContract.off("Minted", getReserves);
        lpContract.off("Burned", getReserves);
        lpContract.off("Swapped", getReserves);
      }
    };
  }, [lpContract]);

  const handleClose = () => setError(null);

  return (
    <>
      <form onSubmit={submit} noValidate autoComplete="off">
        <Box display={"flex"} flexDirection={"column"} alignContent={"center"} component="div" sx={{ mb: 5 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 1 }}>
            Pool
          </Typography>
          <TextField
            disabled={isSubmitting}
            placeholder="ETH"
            type="number"
            value={ethIn}
            onChange={async (e) => {
              setEthIn(e.target.value);
              const ethNumber = Number(e.target.value);
              if (ethReserve.isZero() && spcReserve.isZero()) {
                setSpcIn((ethNumber * 5).toString());
              } else {
                if (ethNumber > 0) {
                  const spc = await spcRouterContract?.calcOptimalAmount(
                    ethers.utils.parseEther(e.target.value),
                    ethReserve,
                    spcReserve
                  );
                  setSpcIn(ethers.utils.formatEther(spc || BigNumber.from(0)));
                  return;
                }
                setSpcIn("0");
              }
            }}
            label="Eth to deposit"
            variant="outlined"
            sx={{ mb: 1 }}
          />
          <TextField
            disabled={isSubmitting}
            placeholder="SPC"
            type="number"
            value={spcIn}
            onChange={async (e) => {
              setSpcIn(e.target.value);
              const spcNumber = Number(e.target.value);
              if (ethReserve.isZero() && spcReserve.isZero()) {
                setEthIn((spcNumber / 5).toString());
              } else {
                if (spcNumber > 0) {
                  const eth = await spcRouterContract?.calcOptimalAmount(
                    ethers.utils.parseEther(e.target.value),
                    spcReserve,
                    ethReserve
                  );
                  setEthIn(ethers.utils.formatEther(eth || BigNumber.from(0)));
                  return;
                }
                setEthIn("0");
              }
            }}
            label="Spc to deposit"
            variant="outlined"
            sx={{ mb: 1 }}
          />
          <Button disabled={isSubmitting} type="submit" variant="outlined">
            Deposit
          </Button>
        </Box>
      </form>
      <div>ETH Reserves: {ethers.utils.formatEther(ethReserve.sub(ethReserve.mod(1e14)))}</div>
      <div>SPC Reserves: {ethers.utils.formatEther(spcReserve.sub(spcReserve.mod(1e14)))}</div>
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

export { DepositLiquidity };
