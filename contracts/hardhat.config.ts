import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'

// Load secrets from the Next.js app's .env.local (one level up)
dotenv.config({ path: '../.env.local' })

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  networks: {
    amoy: {
      url: process.env.POLYGON_AMOY_RPC_URL ?? 'https://rpc-amoy.polygon.technology',
      accounts: process.env.MINTER_PRIVATE_KEY ? [process.env.MINTER_PRIVATE_KEY] : [],
      chainId: 80002,
    },
  },
}

export default config
