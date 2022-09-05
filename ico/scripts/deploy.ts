import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  const [deployer, treasury, investor] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Treasury address:", treasury.address);
  console.log("Investor address:", investor.address);

  const SpaceCoinFactory = await ethers.getContractFactory("SpaceCoin");
  const spaceCoin = await SpaceCoinFactory.deploy(treasury.address);
  await spaceCoin.deployed();

  const SpaceCoinIcoFactory = await ethers.getContractFactory("SpaceCoinIco");
  const spaceCoinIco = await SpaceCoinIcoFactory.deploy(spaceCoin.address, [investor.address]);
  await spaceCoinIco.deployed();

  await spaceCoin.transfer(spaceCoinIco.address, spaceCoin.balanceOf(deployer.address));

  console.log("Token address:", spaceCoin.address);
  console.log("ICO address:", spaceCoinIco.address);

  await hre.run("verify:verify", {
    address: spaceCoin.address,
    constructorArguments: [treasury.address],
  });
  await hre.run("verify:verify", {
    address: spaceCoinIco.address,
    constructorArguments: [spaceCoin.address, [investor.address]],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
