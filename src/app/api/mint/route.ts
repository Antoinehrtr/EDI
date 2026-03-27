import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import sharp from 'sharp'
import { generateBadgeSvg } from '@/lib/generateSvg'
import { uploadPng, uploadJson } from '@/lib/pinata'
import { getMintContract, CONTRACT_ABI } from '@/lib/contract'
import type { BadgeFormData, MintResult } from '@/lib/types'

/**
 * Decode a base58-encoded IPFS CIDv0 (e.g. "QmXXX...") into a bytes32 hex string.
 * CIDv0 = base58( 0x1220 + sha256_hash ), so we strip the 2-byte multihash prefix
 * and return the raw 32-byte SHA-256 digest that the optimised contract stores.
 */
function cidToBytes32(cid: string): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let num = 0n
  for (const char of cid) {
    const idx = ALPHABET.indexOf(char)
    if (idx < 0) throw new Error(`Invalid base58 character: ${char}`)
    num = num * 58n + BigInt(idx)
  }
  // 34 hex bytes (68 chars): first 2 bytes are 0x1220 (multihash prefix), rest is the hash
  const hex = num.toString(16).padStart(68, '0')
  return '0x' + hex.slice(4) // drop the 0x1220 prefix → 32 bytes
}

export async function POST(req: NextRequest) {
  try {
    const data: BadgeFormData = await req.json()

    // Basic validation
    if (!data.recipientWallet || !ethers.isAddress(data.recipientWallet)) {
      return NextResponse.json({ error: 'Invalid recipient wallet address' }, { status: 400 })
    }
    if (!data.firstName || !data.lastName) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }

    // 1. Generate badge SVG → convert to PNG (better NFT platform support than SVG)
    const svg = generateBadgeSvg(data)
    const slug = `${data.lastName}-${data.firstName}`.toLowerCase().replace(/\s+/g, '-')
    const png = await sharp(Buffer.from(svg)).png().toBuffer()

    // 2. Upload PNG image to IPFS
    const imageCid = await uploadPng(png, `${slug}-badge.png`)
    const imageUri = `ipfs://${imageCid}`

    // 3. Build ERC-721 metadata
    const metadata = {
      name: `EDI Badge — ${data.firstName} ${data.lastName}`,
      description: data.details || `Completion badge for ${data.project}`,
      image: imageUri,
      attributes: [
        { trait_type: 'Project', value: data.project },
        { trait_type: 'Start Date', value: data.startDate },
        { trait_type: 'Completion Date', value: data.completionDate },
        ...(data.imageUrl ? [{ trait_type: 'Avatar URL', value: data.imageUrl }] : []),
      ],
    }

    // 4. Upload metadata JSON to IPFS
    const metaCid = await uploadJson(metadata, `${slug}-metadata.json`)
    const metadataUri = `ipfs://${metaCid}`

    // 5. Decode CID → bytes32 for the optimised contract, then mint
    const ipfsHash = cidToBytes32(metaCid)
    const contract = getMintContract()
    const tx = await contract.mint(data.recipientWallet, ipfsHash, {
      maxFeePerGas: ethers.parseUnits('35', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('25', 'gwei'),
    })
    const receipt = await tx.wait(1)

    // 6. Parse token ID from BadgeMinted event
    let tokenId = '0'
    const iface = new ethers.Interface(CONTRACT_ABI)
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data })
        if (parsed?.name === 'BadgeMinted') {
          tokenId = parsed.args.tokenId.toString()
          break
        }
      } catch {}
    }

    const result: MintResult = {
      txHash: receipt.hash,
      tokenId,
      metadataUri,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/mint]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
