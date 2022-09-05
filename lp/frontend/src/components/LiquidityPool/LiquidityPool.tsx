import { FC, useState } from "react";

import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";

import { DepositLiquidity } from "./DepositLiquidity";
import { WithdrawLiquidity } from "./WithdrawLiquidity";
import { Trade } from "./Trade";

const LiquidityPool: FC<{ address: string }> = ({ address }) => {
  return (
    <>
      <Grid container spacing={5}>
        <Grid item xs={4}>
          <Paper elevation={4} sx={{ pt: 2, pb: 2, pl: 5, pr: 5, height: "400px" }} component="div">
            <DepositLiquidity address={address} />
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper elevation={4} sx={{ pt: 2, pb: 2, pl: 5, pr: 5, height: "400px" }} component="div">
            <WithdrawLiquidity address={address} />
          </Paper>
        </Grid>
        <Grid item xs={4}>
          <Paper elevation={4} sx={{ pt: 2, pb: 2, pl: 5, pr: 5, height: "400px" }} component="div">
            <Trade />
          </Paper>
        </Grid>
      </Grid>
    </>
  );
};

export { LiquidityPool };
