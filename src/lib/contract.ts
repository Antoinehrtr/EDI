import { ethers } from 'ethers'

// Minimal ABI — only what the app needs
const ABI = [
  'function mint(address to, string calldata tokenURI_) external returns (uint256)',
  'event BadgeMinted(address indexed recipient, uint256 indexed tokenId, string tokenURI)',
]

export function getMintContract() {
  const rpcUrl = process.env.POLYGON_AMOY_RPC_URL
  const privateKey = process.env.MINTER_PRIVATE_KEY
  const contractAddress = process.env.CONTRACT_ADDRESS

  if (!rpcUrl || !privateKey || !contractAddress) {
    throw new Error('Missing required env vars: POLYGON_AMOY_RPC_URL, MINTER_PRIVATE_KEY, CONTRACT_ADDRESS')
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(privateKey, provider)
  return new ethers.Contract(contractAddress, ABI, wallet)
}

export { ABI as CONTRACT_ABI }
