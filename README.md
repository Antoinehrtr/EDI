# EDI Badge Minter

A public web application that lets anyone mint a thank-you, farewell, or completion badge as an NFT on the Polygon Amoy Testnet. No wallet required for the sender — just fill in the form, and the badge is minted directly to the recipient's wallet.

Built for the ELCA Digital Innovation (EDI) hiring challenge.

---

## Table of Contents

1. [What it does](#what-it-does)
2. [Architecture overview](#architecture-overview)
3. [Project structure](#project-structure)
4. [How the pieces fit together](#how-the-pieces-fit-together)
   - [The smart contract](#the-smart-contract)
   - [Badge image generation (SVG)](#badge-image-generation-svg)
   - [IPFS storage via Pinata](#ipfs-storage-via-pinata)
   - [The minting API route](#the-minting-api-route)
   - [The frontend](#the-frontend)
5. [Data flow — step by step](#data-flow--step-by-step)
6. [Environment variables](#environment-variables)
7. [Local development](#local-development)
8. [Deploying the smart contract](#deploying-the-smart-contract)
9. [Deploying the app to Vercel](#deploying-the-app-to-vercel)
10. [Tech stack rationale](#tech-stack-rationale)
11. [Security notes](#security-notes)

---

## What it does

The app presents a simple form where any user (no wallet, no account) can:

1. Fill in details about a person: name, project, dates, a short message, and optionally an avatar/logo image URL.
2. Provide the **recipient's Ethereum wallet address** (the person receiving the badge).
3. Click **"Mint Badge"** — the app takes care of everything else.

Behind the scenes, the app:
- Dynamically generates a custom **SVG badge image** from the form data.
- Uploads that image to **IPFS** via Pinata (permanent, decentralised storage).
- Builds an **ERC-721 metadata JSON** file and uploads it to IPFS too.
- Calls the smart contract to **mint the NFT** on Polygon Amoy Testnet, sending it directly to the recipient's wallet.
- Shows the user a **transaction link** to PolygonScan so they can verify it on-chain.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│                                                             │
│   BadgeMinterPage (React, client-side)                      │
│   ├── Form fields  →  state                                 │
│   └── BadgePreview  ←  generateBadgeSvg(state)  (live SVG) │
│                              ↓ fetch POST /api/mint         │
└──────────────────────────────┼──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Next.js API Route                         │
│                    /api/mint  (server-side, Node.js)         │
│                                                             │
│   1. Validate input                                         │
│   2. generateBadgeSvg(data)   →   SVG string               │
│   3. uploadSvg(svg)           →   ipfs://...  (Pinata)      │
│   4. uploadJson(metadata)     →   ipfs://...  (Pinata)      │
│   5. contract.mint(wallet, metadataUri)  (ethers.js v6)     │
│   6. Return { txHash, tokenId, metadataUri }                │
└──────────────────────────────┬──────────────────────────────┘
                               │
          ┌────────────────────┴────────────────────┐
          │                                         │
┌─────────▼──────────┐                   ┌──────────▼─────────┐
│  Pinata / IPFS     │                   │  Polygon Amoy      │
│                    │                   │  Testnet           │
│  badge.svg         │                   │                    │
│  metadata.json     │                   │  EDIBadge.sol      │
│  (permanent URLs)  │                   │  (ERC-721)         │
└────────────────────┘                   └────────────────────┘
```

The key design principle: **the server holds the minter wallet's private key**. The browser never touches it. Any visitor can trigger a mint by providing a recipient address, because the signing happens entirely on the server.

---

## Project structure

```
.
├── .env.example                  # Template: env vars you need to fill in
├── .env.local                    # Your actual secrets (never committed)
├── .gitignore
├── next.config.ts                # Next.js config (allows remote images)
├── tailwind.config.ts
├── tsconfig.json
├── package.json                  # Next.js app dependencies
│
├── contracts/                    # Hardhat sub-project (contract only)
│   ├── package.json              # Hardhat dependencies (separate from the app)
│   ├── hardhat.config.ts         # Network config (reads from ../.env.local)
│   ├── contracts/
│   │   └── EDIBadge.sol          # The ERC-721 smart contract
│   └── scripts/
│       └── deploy.ts             # One-time deployment script
│
└── src/
    ├── app/                      # Next.js App Router
    │   ├── layout.tsx            # Root layout (fonts, metadata, dark background)
    │   ├── page.tsx              # Entry point — renders BadgeMinterPage
    │   ├── globals.css           # Tailwind directives
    │   └── api/
    │       └── mint/
    │           └── route.ts      # POST /api/mint — the entire mint pipeline
    │
    ├── components/
    │   ├── BadgeMinterPage.tsx   # Main client component: form state + layout
    │   └── BadgePreview.tsx      # Renders the live SVG preview
    │
    └── lib/
        ├── types.ts              # Shared TypeScript types
        ├── generateSvg.ts        # Pure function: BadgeFormData → SVG string
        ├── pinata.ts             # IPFS upload helpers (raw fetch, no SDK)
        └── contract.ts           # ethers.js contract instance factory
```

---

## How the pieces fit together

### The smart contract

**File:** `contracts/contracts/EDIBadge.sol`

The contract is a standard **ERC-721** token, using two OpenZeppelin base contracts:

- **`ERC721URIStorage`** — extends the base ERC-721 with per-token URI storage. Each token ID maps to a `tokenURI`, which is the IPFS URL of its metadata JSON. This is how NFT marketplaces (OpenSea, etc.) know what image and attributes to display.
- **`Ownable`** — restricts the `mint` function to a single "owner" address (the minter wallet deployed with the contract). This prevents anyone from calling `mint` directly on-chain; only the server can do it.

The contract is minimal by design — it does exactly one thing:

```solidity
function mint(address to, string calldata tokenURI_) external onlyOwner returns (uint256)
```

It mints token `_nextTokenId` to `to`, stores `tokenURI_` for it, emits a `BadgeMinted` event, and returns the token ID. That's it.

The contract is deployed **once** to Polygon Amoy. After that, the address is stored in an environment variable and the app uses it forever. The minter wallet that deployed the contract is also the wallet that calls `mint` from the server.

---

### Badge image generation (SVG)

**File:** `src/lib/generateSvg.ts`

This is the most important library function in the app. It takes a `BadgeFormData` object and returns a raw SVG string.

**Why SVG?**

SVG was chosen over canvas-based PNG generation (which would require `satori`, `@resvg/resvg-js`, or `sharp`) because:
- It is a pure string operation — no native binaries, no Node.js-specific APIs.
- The same function runs in **both the browser and the server** without any adaptation.
- The live preview and the minted image are **100% identical** — same function, same output.
- SVG is fully supported as an NFT image format by OpenSea and PolygonScan.

The function takes care of a few important things:

1. **XML escaping** — user-provided text is run through an `esc()` helper that replaces `&`, `<`, `>`, `"` with their XML entities. Without this, a name like `O'Brien & Co.` would break the SVG XML.

2. **Truncation** — SVG `<text>` elements do not wrap automatically. Long strings are truncated with a `…` character to prevent overflow.

3. **Conditional avatar** — if the user provides an `imageUrl`, the SVG embeds it in a circular clip path using `<image href="...">`. If not, it shows the person's initials in a styled circle instead.

4. **Date formatting** — raw `YYYY-MM-DD` date strings are converted to a human-readable format (`15 Jan 2025`) before being embedded.

The SVG uses a dark navy gradient background, gold (`#f59e0b`) accents, a gold border, and decorative corner brackets — designed to look like a physical badge or certificate.

---

### IPFS storage via Pinata

**File:** `src/lib/pinata.ts`

NFT metadata must be stored somewhere permanent and publicly accessible. A regular web server won't do — if the server goes down, the NFT metadata disappears and the NFT becomes worthless. **IPFS** (InterPlanetary File System) solves this: files are addressed by their content hash, so a file uploaded to IPFS today can still be retrieved years later from any IPFS node.

**Pinata** is a pinning service — it runs IPFS nodes and "pins" your files so they stay available. It has a generous free tier. Files are accessed via `https://ipfs.io/ipfs/<CID>` or the native `ipfs://<CID>` URI.

The module exposes two functions:

- **`uploadSvg(svgString, filename)`** — converts the SVG string to a `Blob`, wraps it in a `FormData`, and POSTs it to `https://api.pinata.cloud/pinning/pinFileToIPFS`. Returns the IPFS CID (content identifier hash).

- **`uploadJson(obj, filename)`** — POSTs the metadata object directly to `https://api.pinata.cloud/pinning/pinJSONToIPFS`. Returns the CID.

Both functions are **server-only** — they read `process.env.PINATA_JWT` which is never exposed to the client bundle.

The metadata JSON uploaded to IPFS follows the **ERC-721 metadata standard**:

```json
{
  "name": "EDI Badge — Jane Doe",
  "description": "A short message about this person's contribution",
  "image": "ipfs://<svg-cid>",
  "attributes": [
    { "trait_type": "Project", "value": "Digital Transformation Initiative" },
    { "trait_type": "Start Date", "value": "2024-01-15" },
    { "trait_type": "Completion Date", "value": "2025-03-31" }
  ]
}
```

This format is understood by OpenSea, PolygonScan, and all major NFT platforms.

---

### The minting API route

**File:** `src/app/api/mint/route.ts`

This is the server-side heart of the app. It is a Next.js **Route Handler** (the App Router equivalent of an API route), running in the Node.js runtime.

It receives a `POST` request with the form data as JSON and executes the full pipeline:

1. **Parse & validate** — reads the JSON body, checks that the recipient wallet is a valid Ethereum address using `ethers.isAddress()`, and that required fields are present. Returns a `400` if not.

2. **Generate SVG** — calls `generateBadgeSvg(data)` to produce the SVG string.

3. **Upload SVG to IPFS** — calls `uploadSvg()` from `pinata.ts`. Gets back a CID, builds `ipfs://<cid>` as the image URI.

4. **Build metadata** — constructs the ERC-721 metadata object.

5. **Upload metadata to IPFS** — calls `uploadJson()`. Gets back a CID, builds `ipfs://<cid>` as the token URI.

6. **Mint on-chain** — calls `getMintContract()` from `contract.ts` to get an `ethers.Contract` instance signed by the minter wallet, then calls `contract.mint(recipientWallet, tokenURI)`. This broadcasts a transaction to the Polygon Amoy network and waits for 1 confirmation (`tx.wait(1)`).

7. **Extract token ID** — parses the `BadgeMinted` event from the transaction receipt logs using `ethers.Interface`. This gives the exact token ID that was assigned.

8. **Return result** — responds with `{ txHash, tokenId, metadataUri }` as JSON.

If anything fails (Pinata down, wallet out of funds, RPC timeout, etc.), the error is caught, logged server-side, and a `500` with the error message is returned.

---

### The frontend

**Files:** `src/components/BadgeMinterPage.tsx`, `src/components/BadgePreview.tsx`

The frontend is a **single-page React app** embedded in a Next.js App Router page.

`page.tsx` is a **server component** — it renders instantly with no JavaScript overhead. It just mounts the `BadgeMinterPage` client component.

`BadgeMinterPage` is a **client component** (`'use client'`). It owns all the form state using `useState<BadgeFormData>`. Every time a field changes, the state updates immediately. The `BadgePreview` component receives this state as a prop and re-renders — it calls `generateBadgeSvg(data)` synchronously and renders the result via `dangerouslySetInnerHTML`. Because SVG generation is a pure, cheap string operation, this is instant — no debounce, no API call, no lag. The preview is always in sync with the form.

When the user submits the form, `handleMint()` POSTs to `/api/mint`, tracks the loading/success/error state, and displays the result below the form (a PolygonScan link on success, an error message on failure).

The layout is a two-column grid on large screens (form left, preview right), collapsing to a single column on mobile. Styling uses Tailwind CSS — dark navy/slate palette with gold accents to match the badge design.

---

## Data flow — step by step

Here is what happens, in order, when a user clicks "Mint Badge":

```
1.  Browser: form state → fetch POST /api/mint  (JSON body)

2.  Server: validate recipient wallet address
    └─ invalid? → return 400

3.  Server: generateBadgeSvg(data)
    └─ produces SVG string (same as the live preview)

4.  Server: POST https://api.pinata.cloud/pinning/pinFileToIPFS
    └─ body: SVG as multipart/form-data
    └─ response: { IpfsHash: "Qm..." }
    └─ imageCid = "Qm..."

5.  Server: build metadata JSON
    {
      name, description, image: "ipfs://Qm...", attributes: [...]
    }

6.  Server: POST https://api.pinata.cloud/pinning/pinJSONToIPFS
    └─ body: { pinataContent: metadata }
    └─ response: { IpfsHash: "Qm..." }
    └─ metadataCid = "Qm..."

7.  Server: ethers.Wallet.sendTransaction via contract.mint(to, "ipfs://Qm...")
    └─ wallet signs the tx with MINTER_PRIVATE_KEY
    └─ tx broadcast to Polygon Amoy via POLYGON_AMOY_RPC_URL
    └─ await tx.wait(1)  →  receipt

8.  Server: parse BadgeMinted event from receipt.logs
    └─ extract tokenId

9.  Server: return { txHash, tokenId, metadataUri }

10. Browser: show success banner with PolygonScan link
```

---

## Environment variables

Create a `.env.local` file at the project root (never commit this file):

```bash
# The private key of the wallet that owns the contract and signs mint transactions.
# Generate a new wallet at https://app.mycrypto.com or with `cast wallet new` (Foundry).
# Fund it with Amoy POL from https://faucet.polygon.technology
MINTER_PRIVATE_KEY=0x...

# Polygon Mainnet (optional — only needed if you plan to mint on mainnet)
POLYGON_MAINNET_RPC_URL=https://polygon-bor-rpc.publicnode.com
POLYGON_MAINNET_CONTRACT=0x...

# Polygon Amoy Testnet (default network for this project)
# You get the contract address after running the deploy script (see below).
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_AMOY_CONTRACT=0x...

# JWT token from Pinata. Create a key at https://app.pinata.cloud/keys
# with "pinFileToIPFS" and "pinJSONToIPFS" permissions.
PINATA_JWT=eyJ...

# Optional: expose this only when you need Hardhat contract verification
POLYGONSCAN_API_KEY=...
```

---

## Local development

**Prerequisites:** Node.js 18+, npm.

```bash
# 1. Install app dependencies
npm install

# 2. Copy the env template and fill it in
cp .env.example .env.local
# Edit .env.local with your values

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The live preview works immediately even without env vars. Minting requires all four env vars to be set.

---

## Deploying the smart contract

The contract is in its own sub-project under `contracts/`. It is deployed once and then left alone — the app only needs the resulting address.

```bash
# 1. Install Hardhat dependencies
cd contracts
npm install

# 2. Make sure .env.local at the project root has MINTER_PRIVATE_KEY
#    and POLYGON_AMOY_RPC_URL set (hardhat.config.ts reads from ../.env.local)

# 3. Fund the minter wallet with Amoy POL
#    Faucet: https://faucet.polygon.technology
#    You need a small amount for gas (~0.1 POL is plenty)

# 4. Deploy
npx hardhat run scripts/deploy.ts --network amoy
```

The script prints the deployed contract address. Copy it into `.env.local` as `POLYGON_AMOY_CONTRACT` (or `POLYGON_MAINNET_CONTRACT` if you deployed to Polygon mainnet).

You only need to do this once. After deployment, the minter wallet is the contract owner and the only address allowed to call `mint()`.

---

## Deploying the app to Vercel

```bash
# 1. Push the repository to GitHub (the contracts/ folder is harmless to include)

# 2. Go to vercel.com → New Project → import your repo

# 3. In the Vercel project settings → Environment Variables, add:
#    MINTER_PRIVATE_KEY
#    POLYGON_AMOY_CONTRACT
#    POLYGON_AMOY_RPC_URL
#    PINATA_JWT
#    (optional) POLYGON_MAINNET_CONTRACT
#    (optional) POLYGON_MAINNET_RPC_URL

# 4. Deploy — Vercel auto-detects Next.js and builds it correctly
```

No special Vercel configuration is needed. The `contracts/` folder is ignored by Next.js and does not affect the build.

---

## Tech stack rationale

| Technology | Role | Why this choice |
|---|---|---|
| **Next.js 14 (App Router)** | Full-stack framework | Native Vercel deployment. Handles both the React frontend and the server-side API route in a single project. No need for a separate backend. |
| **TypeScript** | Language | Type safety across the shared `BadgeFormData` type used by the form, the preview, and the API route. Catches mistakes at compile time (e.g. a typo in a field name). |
| **Tailwind CSS** | Styling | Utility-first, no separate CSS files to maintain, great for a small app. Dark mode is trivial with `bg-slate-950` etc. |
| **SVG (hand-rolled)** | Badge image | The same pure function runs in the browser (for live preview) and on the server (for IPFS upload). No native binary dependencies. Universally supported as an NFT image format. |
| **ethers.js v6** | Blockchain interaction | The standard library for EVM development in JavaScript. v6 has a cleaner TypeScript API than v5. Server-only — the private key never leaves the server. |
| **OpenZeppelin ERC-721** | Smart contract base | Battle-tested, audited contracts. `ERC721URIStorage` handles per-token metadata URIs. `Ownable` gates the mint function to the server wallet with one line. No need to write low-level ERC-721 logic from scratch. |
| **Pinata (raw fetch)** | IPFS pinning | No SDK needed — two API calls, two thin wrappers. Free tier is sufficient. IPFS ensures the badge metadata outlives the app. |
| **Polygon Amoy Testnet** | Blockchain network | Required by the challenge. Low/zero gas costs with free faucet POL. Same EVM as mainnet — the contract and app code would work unchanged on Polygon Mainnet. |
| **Hardhat** | Contract toolchain | Industry-standard Ethereum development environment. Compiles Solidity, manages OpenZeppelin imports, and deploys to any network. Isolated in its own `contracts/` sub-project so it does not bloat the Next.js app bundle. |

---

## Security notes

- **The minter private key is never sent to the browser.** It lives only in `.env.local` and Vercel's encrypted environment variable storage. The `/api/mint` route is the only place it is used, and it runs exclusively on the server.
- **The contract is `onlyOwner`.** Even if someone calls the Amoy contract address directly (e.g. via Etherscan), they cannot mint — only the owner wallet can.
- **User input is XML-escaped** before being inserted into the SVG. This prevents malformed SVGs and eliminates any SVG injection risk.
- **Wallet address validation** happens before any external call. `ethers.isAddress()` rejects anything that isn't a valid Ethereum address, preventing garbage data from reaching the contract.
- **`.env.local` is gitignored** — you cannot accidentally commit your private key.
