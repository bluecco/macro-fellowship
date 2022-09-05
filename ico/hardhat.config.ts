import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    rinkeby: {
      url: process.env.RINKEBY_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined &&
        process.env.PRIVATE_KEY_TREASURY !== undefined &&
        process.env.PRIVATE_KEY_INVESTOR !== undefined
          ? [process.env.PRIVATE_KEY, process.env.PRIVATE_KEY_TREASURY, process.env.PRIVATE_KEY_INVESTOR]
          : [],
    },
    hardhat: {
      accounts: {
        count: 40,
      },
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
