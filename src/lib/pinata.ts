const PINATA_API = 'https://api.pinata.cloud/pinning'

function authHeader() {
  const jwt = process.env.PINATA_JWT
  if (!jwt) throw new Error('PINATA_JWT env var is not set')
  return { Authorization: `Bearer ${jwt}` }
}

export async function uploadPng(pngBuffer: Buffer, filename: string): Promise<string> {
  const blob = new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' })
  const form = new FormData()
  form.append('file', blob, filename)
  form.append('pinataMetadata', JSON.stringify({ name: filename }))

  const res = await fetch(`${PINATA_API}/pinFileToIPFS`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
  })
  if (!res.ok) throw new Error(`Pinata file upload failed: ${await res.text()}`)
  const { IpfsHash } = await res.json()
  return IpfsHash as string
}

export async function uploadJson(obj: object, filename: string): Promise<string> {
  const res = await fetch(`${PINATA_API}/pinJSONToIPFS`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinataMetadata: { name: filename }, pinataContent: obj }),
  })
  if (!res.ok) throw new Error(`Pinata JSON upload failed: ${await res.text()}`)
  const { IpfsHash } = await res.json()
  return IpfsHash as string
}
