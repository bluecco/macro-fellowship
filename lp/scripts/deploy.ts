import { ethers } from "hardhat";

async function main() {
  const [deployer, treasury, investor] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Treasury address:", treasury.address);
  console.log("Investor address:", investor.address);

  const SpaceCoinFactory = await ethers.getContractFactory("SpaceCoin");
  const spaceCoin = await SpaceCoinFactory.deploy(treasury.address, {
    maxFeePerGas: 250000000000,
    maxPriorityFeePerGas: 250000000000,
  });
  await spaceCoin.deployed();

  const SpaceCoinIcoFactory = await ethers.getContractFactory("SpaceCoinIco");
  const spaceCoinIco = await SpaceCoinIcoFactory.deploy(spaceCoin.address, treasury.address, [investor.address], {
    maxFeePerGas: 250000000000,
    maxPriorityFeePerGas: 250000000000,
  });
  await spaceCoinIco.deployed();

  await spaceCoin.transfer(spaceCoinIco.address, spaceCoin.balanceOf(deployer.address));

  const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
  const liquidityPool = await LiquidityPool.deploy(spaceCoin.address, {
    maxFeePerGas: 250000000000,
    maxPriorityFeePerGas: 250000000000,
  });
  await liquidityPool.deployed();

  const SpaceRouter = await ethers.getContractFactory("SpaceRouter");
  const spaceRouter = await SpaceRouter.deploy(liquidityPool.address, spaceCoin.address, {
    maxFeePerGas: 250000000000,
    maxPriorityFeePerGas: 250000000000,
  });
  await spaceRouter.deployed();

  console.log("SpaceCoin address:", spaceCoin.address);
  console.log("SpaceCoinIco address:", spaceCoinIco.address);
  console.log("Liquidity Pool address:", liquidityPool.address);
  console.log("SpaceRouter address:", spaceRouter.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
