import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { generateBadgeSvg } from '@/lib/generateSvg'
import { uploadSvg, uploadJson } from '@/lib/pinata'
import { getMintContract, CONTRACT_ABI } from '@/lib/contract'
import type { BadgeFormData, MintResult } from '@/lib/types'

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

    // 1. Generate badge SVG
    const svg = generateBadgeSvg(data)
    const slug = `${data.lastName}-${data.firstName}`.toLowerCase().replace(/\s+/g, '-')

    // 2. Upload SVG image to IPFS
    const imageCid = await uploadSvg(svg, `${slug}-badge.svg`)
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

    // 5. Mint NFT on-chain
    const contract = getMintContract()
    const tx = await contract.mint(data.recipientWallet, metadataUri)
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
