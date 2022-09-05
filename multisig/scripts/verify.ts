import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  const [_, treasury, investor] = await ethers.getSigners();

  const proxy = "0x2b899f613d3D44C71c88D75E83defDfB145a33DB";
  const logic = "0xFb5bcA5afe25636aB8fC22eA1728821E0Ea1f10a";
  const logicImproved = "0x1E11e1C37B75936667DDb95e28812953db81EAE0";

  await hre.run("verify:verify", {
    address: logic,
    constructorArguments: [],
  });
  await hre.run("verify:verify", {
    address: logicImproved,
    constructorArguments: [],
  });
  await hre.run("verify:verify", {
    address: proxy,
    constructorArguments: [logic],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
