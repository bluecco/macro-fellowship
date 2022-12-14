import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

dotenv.config();

// Dear Student,
//
// This hardhat.config.ts file differs from the Hardhat project boilerplate generated
// when you run `npx hardhat` in a new directory. We suggest you add these same lines
// of code to your future projects, in order to easily setup:
// - environment variables via `dotenv` (you'll need to `mv .env.example .env`)
// - Etherscan source verification
//
// Love,
// Macro Instruction Team

const config: HardhatUserConfig = {
  solidity: "0.8.9",
  networks: {
    rinkeby: {
      url: process.env.RINKEBY_URL || "",
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
