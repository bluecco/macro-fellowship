import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SpaceCoin, LiquidityPool, SpaceRouter } from "../../typechain-types";

const ONE = ethers.BigNumber.from(1);
const TWO = ethers.BigNumber.from(2);

export const ONE_ETHER: BigNumber = ethers.utils.parseEther("1");
export const CLOSE_TO_TOLERANCE = ethers.utils.parseEther("0.1");
export const SLIPPAGE_05_PERCENT = ONE_ETHER.mul(5).div(1000);
export const SLIPPAGE_1_PERCENT = ONE_ETHER.mul(10).div(1000);
export const BASE_ETH_LIQUIDITY = ONE_ETHER.mul(100);
export const BASE_SPC_LIQUIDITY = ONE_ETHER.mul(500);

export const E2E_BASE_ETH_LIQUIDITY = ONE_ETHER.mul(30_000);
export const E2E_BASE_SPC_LIQUIDITY = ONE_ETHER.mul(150_000);

export const apply05percentSlippage = (amount: BigNumber): BigNumber => amount.sub(amount.mul(5).div(100));

export const apply1percentSlippage = (amount: BigNumber): BigNumber => amount.sub(amount.mul(5).div(100));

export const baseMint = async (liquidityPool: LiquidityPool, spaceCoin: SpaceCoin, treasury: SignerWithAddress) => {
  await spaceCoin.connect(treasury).transfer(liquidityPool.address, BASE_SPC_LIQUIDITY);
  await liquidityPool.connect(treasury).mint(treasury.address, { value: BASE_ETH_LIQUIDITY });
};

export function sqrt(value: string): BigNumber {
  const x = ethers.BigNumber.from(value);
  let z = x.add(ONE).div(TWO);
  let y = x;
  while (z.sub(y).isNegative()) {
    y = z;
    z = x.div(z).add(z).div(TWO);
  }
  return y;
}
