import { ethers } from "hardhat";
/* import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"; */
import { Logic, LogicImproved } from "../typechain-types";

async function main() {
  /* const [owner, secondOwner]: SignerWithAddress[] = await ethers.getSigners(); */

  const Logic = await ethers.getContractFactory("Logic");
  const logic: Logic = await Logic.deploy();
  await logic.deployed();

  const LogicImproved = await ethers.getContractFactory("LogicImproved");
  const logicImproved: LogicImproved = await LogicImproved.deploy();
  await logicImproved.deployed();

  const Proxy = await ethers.getContractFactory("Proxy");
  let proxy: Logic = (await Proxy.deploy(logic.address)) as Logic;
  await proxy.deployed();

  console.log(`Proxy address : ${proxy.address}`);
  console.log(`Logic address : ${logic.address}`);
  console.log(`LogicImproved address : ${logicImproved.address}`);

  const attachedProxy = logic.attach(proxy.address);

  const txi = await attachedProxy.initialize(ethers.BigNumber.from(1));
  await txi.wait();

  const tx = await attachedProxy.transferOwnership("0x1FbE308e5838B3Af10EAF13650461198BA78810d"); // gnosis
  await tx.wait();

  console.log("logic.owner() " + (await logic.owner()));
  console.log("attachedProxy.owner() " + (await attachedProxy.owner()));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
