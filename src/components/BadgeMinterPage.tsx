'use client'

import { useState } from 'react'
import BadgePreview from './BadgePreview'
import type { BadgeFormData, MintState } from '@/lib/types'

type AvatarMode = 'url' | 'upload'

const AVATAR_CANVAS_SIZE = 256
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 // 4 MB raw file limit keeps processing quick

async function readFileAsDataURL(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function compressAvatar(file: File): Promise<{ dataUrl: string; bytes: number }> {
  const dataUrl = await readFileAsDataURL(file)
  const image = await loadImageElement(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_CANVAS_SIZE
  canvas.height = AVATAR_CANVAS_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported in this browser')

  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, AVATAR_CANVAS_SIZE, AVATAR_CANVAS_SIZE)

  const scale = Math.max(AVATAR_CANVAS_SIZE / image.width, AVATAR_CANVAS_SIZE / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  const dx = (AVATAR_CANVAS_SIZE - drawWidth) / 2
  const dy = (AVATAR_CANVAS_SIZE - drawHeight) / 2

  ctx.drawImage(image, dx, dy, drawWidth, drawHeight)
  const compactDataUrl = canvas.toDataURL('image/png', 0.9)
  const base64 = compactDataUrl.split(',')[1] ?? ''
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  const bytes = Math.round((base64.length * 3) / 4 - padding)
  return { dataUrl: compactDataUrl, bytes }
}

const EMPTY: BadgeFormData = {
  firstName: '',
  lastName: '',
  project: '',
  startDate: '',
  completionDate: '',
  details: '',
  imageUrl: '',
  recipientWallet: '',
  network: 'mainnet',
}

function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  hint,
}: {
  label: string
  name: keyof BadgeFormData
  value: string
  onChange: (name: keyof BadgeFormData, value: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        {label} {required && <span className="text-amber-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        required={required}
        className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2.5 text-sm
          text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/60
          focus:ring-1 focus:ring-amber-400/20 transition-all duration-150
          [color-scheme:dark]"
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-400/60">{title}</span>
        <div className="flex-1 h-px bg-slate-700/60" />
      </div>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

export default function BadgeMinterPage() {
  const [form, setForm] = useState<BadgeFormData>(EMPTY)
  const [mintState, setMintState] = useState<MintState>({ status: 'idle' })
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('url')
  const [avatarBytes, setAvatarBytes] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  function setField(name: keyof BadgeFormData, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleAvatarModeChange(mode: AvatarMode) {
    setAvatarMode(mode)
    if (mode === 'url') {
      setAvatarBytes(null)
    }
  }

  async function handleAvatarUpload(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) {
      setUploadError('Select an image file to upload')
      return
    }
    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files are supported')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('Image is larger than 4 MB - please pick a smaller file')
      return
    }
    try {
      const { dataUrl, bytes } = await compressAvatar(file)
      setField('imageUrl', dataUrl)
      setAvatarBytes(bytes)
      setUploadError(null)
    } catch (err) {
      console.error(err)
      setUploadError('Unable to process the image. Try another file?')
    }
  }

  function clearAvatar() {
    setField('imageUrl', '')
    setAvatarBytes(null)
    setUploadError(null)
  }

  async function handleMint(e: React.FormEvent) {
    e.preventDefault()
    setMintState({ status: 'loading' })
    try {
      const res = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Minting failed')
      setMintState({ status: 'success', result: json })
    } catch (err) {
      setMintState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const isLoading = mintState.status === 'loading'

  return (
    <main className="min-h-screen px-4 py-14">

      {/* Network Toggle */}
      <div className="max-w-5xl mx-auto mb-6 flex justify-center">
        <div className="inline-flex items-center gap-3 rounded-full bg-slate-800/60 border border-slate-700 px-2 py-1.5">
          <button
            type="button"
            onClick={() => setField('network', 'mainnet')}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
              form.network === 'mainnet'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Polygon Mainnet
          </button>
          <button
            type="button"
            onClick={() => setField('network', 'amoy')}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
              form.network === 'amoy'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Amoy Testnet
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="max-w-5xl mx-auto mb-12 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-amber-400 mb-3">
          ELCA Digital Innovation
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
          EDI Badge Minter
        </h1>
        <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
          Create and mint a thank‑you, farewell, or completion badge as an NFT on{' '}
          {form.network === 'mainnet' ? 'Polygon Mainnet' : 'Polygon Amoy Testnet'}.
          No wallet required.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

        {/* ── Form ── */}
        <form onSubmit={handleMint} className="flex flex-col gap-7">

          <Section title="Recipient">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" name="firstName" value={form.firstName} onChange={setField} required placeholder="Jane" />
              <Field label="Last Name"  name="lastName"  value={form.lastName}  onChange={setField} required placeholder="Doe" />
            </div>
            <Field
              label="Recipient Wallet"
              name="recipientWallet"
              value={form.recipientWallet}
              onChange={setField}
              required
              placeholder="0x…"
              hint="The NFT will be sent to this address."
            />
          </Section>

          <Section title="Badge Content">
            <Field
              label="Main Project"
              name="project"
              value={form.project}
              onChange={setField}
              required
              placeholder="Digital Transformation Initiative"
            />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start Date"      name="startDate"      value={form.startDate}      onChange={setField} type="date" required />
              <Field label="Completion Date" name="completionDate" value={form.completionDate} onChange={setField} type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Details
              </label>
              <textarea
                value={form.details}
                onChange={(e) => setField('details', e.target.value)}
                placeholder="A short message about this person's contribution…"
                rows={3}
                className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2.5 text-sm
                  text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400/60
                  focus:ring-1 focus:ring-amber-400/20 transition-all duration-150 resize-none"
              />
            </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Avatar Source
                  </span>
                  <div className="inline-flex rounded-full bg-slate-900/40 border border-slate-800/80 p-1">
                    {(['url', 'upload'] as AvatarMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleAvatarModeChange(mode)}
                        className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full transition-all duration-150 ${
                          avatarMode === mode
                            ? 'bg-amber-400 text-slate-900 shadow-amber-500/30 shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {mode === 'url' ? 'Use URL' : 'Upload file'}
                      </button>
                    ))}
                  </div>
                </div>
                {avatarMode === 'url' ? (
                  <Field
                    label="Avatar / Image URL"
                    name="imageUrl"
                    value={form.imageUrl}
                    onChange={setField}
                    placeholder="https://example.com/photo.jpg (optional)"
                    hint="Use any publicly accessible image URL."
                  />
                ) : (
                  <div className="flex flex-col gap-2 rounded-xl border border-slate-700/60 bg-slate-900/40 p-3">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Upload (PNG/JPG)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleAvatarUpload(e.target.files)}
                      className="text-sm text-slate-200 file:mr-4 file:rounded-md file:border-0 file:bg-amber-400/90 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-900
                        hover:file:bg-amber-300"
                    />
                    <p className="text-xs text-slate-500">
                      Resized client-side to 256x256 PNG before minting{avatarBytes ? ` (~${Math.max(1, Math.round(avatarBytes / 1024))} KB)` : ''}.
                    </p>
                    {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
                  </div>
                )}
                {form.imageUrl && (
                  <button
                    type="button"
                    onClick={clearAvatar}
                    className="self-start text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Remove current avatar
                  </button>
                )}
              </div>
          </Section>

          {/* Feedback */}
          {mintState.status === 'error' && (
            <div className="rounded-xl bg-red-950/40 border border-red-700/50 px-4 py-3 text-sm text-red-300 flex gap-2 items-start">
              <span className="mt-0.5">⚠</span>
              <span>{mintState.message}</span>
            </div>
          )}

          {mintState.status === 'success' && (
            <div className="rounded-xl bg-emerald-950/40 border border-emerald-700/50 px-4 py-4 text-sm text-emerald-300 flex flex-col gap-3">
              <div className="flex items-center gap-2 font-semibold text-emerald-200">
                <span>✓</span> Badge minted successfully!
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-500 uppercase tracking-wider">Token ID</span>
                  <span className="font-mono text-emerald-300">#{mintState.result.tokenId}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-500 uppercase tracking-wider">Network</span>
                  <span className="text-emerald-300">{form.network === 'mainnet' ? 'Polygon Mainnet' : 'Polygon Amoy'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-1 border-t border-emerald-900/50">
                <a
                  href={`https://${form.network === 'mainnet' ? '' : 'amoy.'}polygonscan.com/tx/${mintState.result.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-200 transition-colors"
                >
                  <span>↗</span> View on PolygonScan
                </a>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300
              active:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500
              text-slate-900 font-bold py-3.5 px-6 text-sm transition-all duration-150
              shadow-lg shadow-amber-900/20"
          >
            {isLoading ? (
              <>
                <Spinner />
                Minting…
              </>
            ) : (
              'Mint Badge'
            )}
          </button>

          <p className="text-xs text-slate-600 text-center -mt-3">
            Minting takes ~15 seconds while the transaction confirms on-chain.
          </p>
        </form>

        {/* ── Preview ── */}
        <div className="lg:sticky lg:top-12 flex flex-col gap-6">
          <BadgePreview data={form} />

          {/* Chain info */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-4 py-3 flex flex-col gap-2 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Network</span>
              <span className="text-slate-400">{form.network === 'mainnet' ? 'Polygon Mainnet' : 'Polygon Amoy Testnet'}</span>
            </div>
            <div className="flex justify-between">
              <span>Standard</span>
              <span className="text-slate-400">ERC-721</span>
            </div>
            <div className="flex justify-between">
              <span>Storage</span>
              <span className="text-slate-400">IPFS via Pinata</span>
            </div>
            <div className="flex justify-between">
              <span>Cost</span>
              <span className={form.network === 'mainnet' ? 'text-amber-400' : 'text-emerald-500'}>
                {form.network === 'mainnet' ? 'Gas fees (POL)' : 'Free'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </main>
  )
}
