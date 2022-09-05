import { FC, FormEvent, useState, useEffect } from "react";
import { ethers, BigNumber } from "ethers";

import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import SwapVertIcon from "@mui/icons-material/SwapVert";

import { liquidityPoolContract } from "../../contracts/LiquidityPool";
import { spaceRouterContract } from "../../contracts/SpaceRouter";
import { spaceCoinTokenContract } from "../../contracts/SpaceCoin";
import { formatError } from "../../helpers/formatError";
import { SpaceRouter, LiquidityPool } from "../../typechain-types";

enum Swap {
  Eth,
  Spc,
}

const Trade: FC<{}> = () => {
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [slippage, setSlippage] = useState("0.1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spcRouter, setSpcRouter] = useState<SpaceRouter | null>();
  const [lpContract, setLpContract] = useState<LiquidityPool | null>();
  const [price, setPrice] = useState<BigNumber>(BigNumber.from(0));

  const [swapIn, setSwapIn] = useState<Swap>(Swap.Eth);
  const [swapOut, setSwapOut] = useState<Swap>(Swap.Spc);

  const { ethereum } = window;

  const minAmount = (value: string) => Number(value) * (1 - Number(slippage));

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      if (spcRouter && lpContract) {
        const parsedAmountOut = ethers.utils.parseEther(`${minAmount(amountOut)}`);
        const parsedAmountIn = ethers.utils.parseEther(amountIn);
        if (swapIn === Swap.Eth) {
          await spcRouter?.swapEthForSpc(parsedAmountOut, {
            value: parsedAmountIn,
          });
        } else {
          const spaceCoinContract = spaceCoinTokenContract(ethereum);
          const allowanceTx = await spaceCoinContract.increaseAllowance(spcRouter.address, parsedAmountIn);
          await allowanceTx.wait();
          await spcRouter?.swapSpcForEth(parsedAmountIn, parsedAmountOut);
        }
      }
      setIsSubmitting(false);
    } catch (error: any) {
      setError(formatError(error, spcRouter));
    } finally {
      setIsSubmitting(false);
    }
    setAmountIn("");
    setAmountOut("");
  };

  const getAmountOut = async (value: string) => {
    const amount = await fetchPrice(ethers.utils.parseEther(value));
    setAmountOut(ethers.utils.formatEther(amount));
  };

  const getPrice = async () => {
    setPrice(await fetchPrice(ethers.utils.parseEther("1")));
  };

  useEffect(() => {
    getPrice();
  }, [swapIn]);

  const fetchPrice = async (price: BigNumber): Promise<BigNumber> => {
    try {
      if (ethereum && spcRouter && lpContract) {
        const [ethReserve, spcReserve]: BigNumber[] = await lpContract.getReserves();
        if (ethReserve.isZero() && spcReserve.isZero()) {
          return BigNumber.from(-1);
        }
        if (swapIn === Swap.Eth) {
          return await spcRouter.getAmountReceived(price, ethReserve, spcReserve);
        } else {
          return await spcRouter.getAmountReceived(price, spcReserve, ethReserve);
        }
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error: any) {
      setError(formatError(error, spcRouter));
    }
    return BigNumber.from(0);
  };

  useEffect(() => {
    if (spcRouter && lpContract) {
      getPrice();
      lpContract.on("Minted", getPrice);
      lpContract.on("Burned", getPrice);
      lpContract.on("Swapped", getPrice);
    }
    return () => {
      if (lpContract) {
        lpContract.off("Minted", getPrice);
        lpContract.off("Swapped", getPrice);
        lpContract.off("Swapped", getPrice);
      }
    };
  }, [spcRouter, lpContract]);

  useEffect(() => {
    const { ethereum } = window;

    if (ethereum) {
      setSpcRouter(spaceRouterContract(ethereum));
      setLpContract(liquidityPoolContract(ethereum));
    } else {
      console.log("Ethereum object not found");
    }
  }, []);

  const handleClose = () => setError(null);

  return (
    <>
      <form onSubmit={submit} noValidate autoComplete="off">
        <Box display={"flex"} flexDirection={"column"} alignContent={"center"} component="div" sx={{ mb: 5 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 1 }}>
            Trade
          </Typography>
          <TextField
            disabled={isSubmitting}
            placeholder={"0"}
            type="number"
            value={amountIn}
            onChange={(e) => {
              setAmountIn(e.target.value);
              if (Number(e.target.value) > 0) {
                getAmountOut(e.target.value);
              } else {
                setAmountOut("0");
              }
            }}
            label={`${Swap[swapIn]} to deposit`}
            variant="outlined"
          />
          <IconButton
            disableRipple
            aria-label="delete"
            size="small"
            onClick={() => {
              const isEth = swapIn === Swap.Eth;
              setSwapIn(isEth ? Swap.Spc : Swap.Eth);
              setSwapOut(isEth ? Swap.Eth : Swap.Spc);
              setAmountIn(amountOut);
              setAmountOut(amountIn);
            }}
          >
            <SwapVertIcon fontSize="inherit" />
          </IconButton>
          <Typography
            gutterBottom
            component="div"
            sx={{
              mb: 1,
              padding: "0 14px",
              height: "54px",
              lineHeight: "52px",
              border: "rgb(190, 190, 190, .87) solid 1px",
              borderRadius: "4px",
            }}
          >
            {amountOut !== "0" ? (
              <div>{amountOut}</div>
            ) : (
              <div style={{ color: "rgb(190, 190, 190, .87)" }}>{`${Swap[swapOut]} received`}</div>
            )}
          </Typography>
          <Typography gutterBottom sx={{ mb: 1, height: "56px", lineHeight: "52px" }}>
            {price.isNegative() ? (
              <>Cannot calc price -- no reserves in pool</>
            ) : (
              <>
                1 {Swap[swapIn].toUpperCase()} = {ethers.utils.formatEther(price)} {Swap[swapOut].toUpperCase()}
              </>
            )}
          </Typography>
          <TextField
            placeholder="0.10"
            fullWidth
            value={slippage}
            onBlur={() => {}}
            onChange={(e) => {
              const value = e.target.value;
              if (!value || parseFloat(e.target.value) === 0) {
                setSlippage("");
                return;
              }
              setSlippage(parseFloat(e.target.value).toFixed(2));
            }}
            label="Slippage"
            variant="outlined"
          />
          <Button disabled={isSubmitting} type="submit" variant="outlined" sx={{ mt: 3 }}>
            Swap
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

export { Trade };
