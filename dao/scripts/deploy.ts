import { ethers } from "hardhat";

async function main() {
  const CollectorDao = await ethers.getContractFactory("CollectorDao");
  const collectorDao = await CollectorDao.deploy();

  await collectorDao.deployed();

  console.log("Lock with 1 ETH deployed to:", collectorDao.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
