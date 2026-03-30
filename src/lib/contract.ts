import { ethers } from 'ethers'
import type { Network } from './types'

// Minimal ABI — only what the app needs
const ABI = [
  'function mint(address to, bytes32 ipfsHash) external returns (uint256)',
  'event BadgeMinted(address indexed recipient, uint256 indexed tokenId)',
]

const NETWORK_CONFIG = {
  mainnet: {
    rpcEnv: 'POLYGON_MAINNET_RPC_URL',
    contractEnv: 'POLYGON_MAINNET_CONTRACT',
  },
  amoy: {
    rpcEnv: 'POLYGON_AMOY_RPC_URL',
    contractEnv: 'POLYGON_AMOY_CONTRACT',
  },
} as const

export function getMintContract(network: Network = 'amoy') {
  const cfg = NETWORK_CONFIG[network]
  const rpcUrl = process.env[cfg.rpcEnv]
  const privateKey = process.env.MINTER_PRIVATE_KEY
  const contractAddress = process.env[cfg.contractEnv]

  if (!rpcUrl || !privateKey || !contractAddress) {
    throw new Error(`Missing env vars for ${network}: ${cfg.rpcEnv}, MINTER_PRIVATE_KEY, ${cfg.contractEnv}`)
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(privateKey, provider)
  return new ethers.Contract(contractAddress, ABI, wallet)
}

export { ABI as CONTRACT_ABI }
