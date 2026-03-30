# EDI Badge Minter

Next.js app for minting recognition badges as ERC-721 NFTs on Polygon. The sender does not need a wallet connection in the browser: the app generates the SVG badge, uploads the image and metadata to IPFS via Pinata, and mints from a server-side wallet directly to the recipient address.

The current UI includes:

- A live badge preview driven by the same SVG generator used for minting
- Support for Polygon Mainnet and Polygon Amoy
- Avatar by URL or local upload
- Server-side minting through a restricted owner-only contract

## Stack

- Next.js 14 App Router
- React 18
- Tailwind CSS
- ethers.js v6
- Pinata for IPFS pinning
- Hardhat + OpenZeppelin for the contract

## How it works

1. The user fills the form in the browser.
2. The app renders a live SVG preview with `generateBadgeSvg()`.
3. On submit, `POST /api/mint` validates the payload.
4. The server uploads the SVG to Pinata.
5. The server builds ERC-721 metadata JSON and uploads that to Pinata.
6. The metadata CID is converted to a raw `bytes32` SHA-256 digest.
7. The server calls the contract `mint(address to, bytes32 ipfsHash)`.
8. The API returns `{ txHash, tokenId, metadataUri }`.

## Project structure

```text
.
├── .env.example
├── README.md
├── next.config.mjs
├── package.json
├── tailwind.config.ts
├── contracts/
│   ├── contracts/EDIBadge.sol
│   ├── hardhat.config.ts
│   ├── package.json
│   └── scripts/deploy.ts
└── src/
    ├── app/
    │   ├── api/mint/route.ts
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── BadgeMinterPage.tsx
    │   └── BadgePreview.tsx
    └── lib/
        ├── contract.ts
        ├── generateSvg.ts
        ├── pinata.ts
        └── types.ts
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Required for minting:

| Variable | Purpose |
|---|---|
| `MINTER_PRIVATE_KEY` | Private key of the wallet that owns the contract and signs mint transactions |
| `PINATA_JWT` | Pinata JWT with `pinFileToIPFS` and `pinJSONToIPFS` access |
| `POLYGON_MAINNET_RPC_URL` | RPC endpoint for Polygon mainnet |
| `POLYGON_MAINNET_CONTRACT` | Deployed contract address on Polygon mainnet |
| `POLYGON_AMOY_RPC_URL` | RPC endpoint for Polygon Amoy |
| `POLYGON_AMOY_CONTRACT` | Deployed contract address on Polygon Amoy |

Optional:

| Variable | Purpose |
|---|---|
| `POLYGONSCAN_API_KEY` | Contract verification / explorer tooling for Hardhat |

Notes:

- The frontend preview works without secrets.
- Minting fails if the selected network is missing its RPC URL or contract address.
- The contract tooling reads `../.env.local` from the `contracts/` folder, so one root `.env.local` is enough for both app and Hardhat.

## Run locally

Prerequisites:

- Node.js 18+
- npm

Install and run the app:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Useful commands:

```bash
npm run build
npm run start
```

## Smart contract

Contract file: `contracts/contracts/EDIBadge.sol`

Key points:

- ERC-721 contract using `ERC721` + `Ownable`
- `mint(address to, bytes32 ipfsHash)` is restricted to `onlyOwner`
- The contract stores only the raw 32-byte metadata hash, not the full URI string
- `tokenURI()` reconstructs the final `ipfs://...` URI on-chain using base58 encoding
- The app listens for the `BadgeMinted(address recipient, uint256 tokenId)` event to recover the minted token ID

This is different from a typical `ERC721URIStorage` setup. The README previously described URI storage directly on-chain; that is no longer true.

## Deploy the contract

Install dependencies in the Hardhat sub-project:

```bash
cd contracts
npm install
```

Compile:

```bash
npm run compile
```

Deploy to Amoy:

```bash
npm run deploy:amoy
```

Deploy to Polygon mainnet:

```bash
npx hardhat run scripts/deploy.ts --network polygon
```

The deploy script prints the contract address and the env var you should add to `.env.local`.

## API route

File: `src/app/api/mint/route.ts`

What it does:

- Validates the recipient wallet and required fields
- Generates the final SVG server-side
- Uploads the SVG and metadata to Pinata
- Converts the metadata CIDv0 to `bytes32`
- Mints through `getMintContract(network)`
- Returns transaction hash, token ID, and metadata URI

Network behavior:

- The route accepts `mainnet` or `amoy` from the form payload
- For Amoy, it applies fixed low-fee EIP-1559 gas options
- For Mainnet, it uses network-provided fee data

## Frontend

Main files:

- `src/components/BadgeMinterPage.tsx`
- `src/components/BadgePreview.tsx`
- `src/lib/generateSvg.ts`

Current behavior:

- Live preview uses the same SVG generator as the minted asset
- The background has mouse-reactive parallax, but the form itself stays fixed
- Users can provide an avatar as either a public URL or a local upload
- Local uploads are resized client-side to `256x256` PNG before minting

## Deployment

The app is a standard Next.js project and can be deployed to Vercel or any Node-compatible host.

Minimum environment variables for production:

```bash
MINTER_PRIVATE_KEY
PINATA_JWT
POLYGON_MAINNET_RPC_URL
POLYGON_MAINNET_CONTRACT
POLYGON_AMOY_RPC_URL
POLYGON_AMOY_CONTRACT
```

## Security notes

- The private key is used only on the server.
- The browser never signs transactions.
- The contract is owner-gated, so users cannot mint by calling it directly unless they control the owner wallet.
- User text is XML-escaped before being injected into the SVG.
- Wallet addresses are validated with `ethers.isAddress()` before minting.
