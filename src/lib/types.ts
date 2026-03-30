export type Network = 'mainnet' | 'amoy'

export interface BadgeFormData {
  firstName: string
  lastName: string
  project: string
  startDate: string       // "YYYY-MM-DD"
  completionDate: string  // "YYYY-MM-DD"
  details: string
  imageUrl: string        // optional URL or data URI for avatar/logo inside the badge
  recipientWallet: string // 0x... address
  network: Network
}

export interface MintResult {
  txHash: string
  tokenId: string
  metadataUri: string
}

export type MintState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: MintResult }
  | { status: 'error'; message: string }
