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
import { formatError } from "../../helpers/formatError";
import { LiquidityPool } from "../../typechain-types";

const WithdrawLiquidity: FC<{ address: string}> = ({ address }) => {
  const [lpOut, setLpOut] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [lpContract, setLpContract] = useState<LiquidityPool | null>();
  const [lpBalance, setLpBalance] = useState<BigNumber>(BigNumber.from(0));

  const { ethereum } = window;

  const getLpTokens = async () => {
    try {
      if (ethereum && lpContract) {
        const lp = await lpContract.balanceOf(address);
        setLpBalance(lp);
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error: any) {
      setError(formatError(error, lpContract));
    }
  };

  useEffect(() => {
    if (lpContract) {
      getLpTokens();
      lpContract.on("Minted", getLpTokens);
      lpContract.on("Burned", getLpTokens);
    }
    return () => {
      if (lpContract) {
        lpContract.off("Minted", getLpTokens);
        lpContract.off("Burned", getLpTokens);
      }
    };
  }, [lpContract]);

  useEffect(() => {
    const { ethereum } = window;

    if (ethereum) {
      setLpContract(liquidityPoolContract(ethereum));
    } else {
      console.log("Ethereum object not found");
    }
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { ethereum } = window;
    const spcRouterContract = spaceRouterContract(ethereum);
    setInputError("");

    if (!!inputError) {
      return;
    }

    try {
      setIsSubmitting(true);

      if (lpContract) {
        const liquidity = ethers.utils.parseEther(lpOut);

        const totalSupply = await lpContract.totalSupply();
        if (totalSupply === BigNumber.from(0)) {
          return;
        }
        
        const allowanceTx = await lpContract.increaseAllowance(
          spcRouterContract.address,
          liquidity.add(lpBalance.mul(5).div(100))
        );
        await allowanceTx.wait();

        const tx = await spcRouterContract.withdraw(
          liquidity
        );
        await tx.wait();
      }

      setIsSubmitting(false);
    } catch (error: any) {
      console.log(error);
      setError(formatError(error, spcRouterContract));
    } finally {
      setIsSubmitting(false);
    }
    setLpOut("");
  };

  const handleClose = () => setError(null);

  return (
    <>
      <form onSubmit={submit} noValidate autoComplete="off">
        <Box display={"flex"} flexDirection={"column"} alignContent={"center"} component="div" sx={{ mb: 5 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 1 }}>
            Withdraw
          </Typography>
          <Typography gutterBottom sx={{ mb: 1, height: "56px", lineHeight: "52px" }}>
            {ethers.utils.formatEther(lpBalance)}
          </Typography>
          <Box display="flex">
            <TextField
              disabled={isSubmitting}
              error={!!inputError}
              helperText={inputError}
              fullWidth
              placeholder="LP tokens"
              type="number"
              value={lpOut}
              onChange={(e) => {
                if (
                  Number(e.target.value) !== 0 &&
                  Number(e.target.value) > Number(ethers.utils.formatEther(lpBalance))
                ) {
                  setInputError("wrong amount");
                } else {
                  setInputError("");
                }

                setLpOut(BigNumber.from(Number(e.target.value)).toString());

                /* setLpOut(ethers.utils.parseEther(BigNumber.from(Number(e.target.value)).toString())); */
              }}
              label="LP to withdraw"
              variant="outlined"
              sx={{ mb: 1 }}
            />
            <Button
              disabled={isSubmitting}
              onClick={() => {
                setLpOut(ethers.utils.formatEther(lpBalance));
              }}
              variant="outlined"
              sx={{ ml: 1, height: "56px" }}
            >
              max
            </Button>
          </Box>
          <Button disabled={isSubmitting || Number(lpOut) === 0 || !!inputError} type="submit" variant="outlined">
            Withdraw
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

export { WithdrawLiquidity };
