import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  const [_, treasury, investor] = await ethers.getSigners();

  const spaceCoin = "0x6d6571DD43481589d91a908bD8db74103960937e";
  const spaceCoinIco = "0x28f21007Cd79DA1aCB998CCDFd89b8966092A56c";
  const liquidityPool = "0xF1f64C9f582fF9c906A5BF19815D603cE28b2A15";
  const spaceRouter = "0x0A49884d6359c70DE5131542DEBF2119785D99a6";

  await hre.run("verify:verify", {
    address: spaceCoin,
    constructorArguments: [treasury.address],
  });
  await hre.run("verify:verify", {
    address: spaceCoinIco,
    constructorArguments: [spaceCoin, treasury.address, [investor.address]],
  });
  await hre.run("verify:verify", {
    address: liquidityPool,
    constructorArguments: [spaceCoin],
  });
  await hre.run("verify:verify", {
    address: spaceRouter,
    constructorArguments: [liquidityPool, spaceCoin],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
