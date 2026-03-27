'use client'

import { useState } from 'react'
import BadgePreview from './BadgePreview'
import type { BadgeFormData, MintState } from '@/lib/types'

const EMPTY: BadgeFormData = {
  firstName: '',
  lastName: '',
  project: '',
  startDate: '',
  completionDate: '',
  details: '',
  imageUrl: '',
  recipientWallet: '',
}

function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string
  name: keyof BadgeFormData
  value: string
  onChange: (name: keyof BadgeFormData, value: string) => void
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        {label} {required && <span className="text-amber-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        required={required}
        className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2 text-sm
          text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400
          focus:ring-1 focus:ring-amber-400/30 transition"
      />
    </div>
  )
}

export default function BadgeMinterPage() {
  const [form, setForm] = useState<BadgeFormData>(EMPTY)
  const [mintState, setMintState] = useState<MintState>({ status: 'idle' })

  function setField(name: keyof BadgeFormData, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }))
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
    <main className="min-h-screen px-4 py-12">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-400 mb-2">
          ELCA Digital Innovation
        </p>
        <h1 className="text-4xl font-bold text-white mb-3">EDI Badge Minter</h1>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Create and mint a thank‑you, farewell, or completion badge as an NFT on Polygon Amoy
          Testnet. No wallet required.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        {/* Form */}
        <form onSubmit={handleMint} className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" name="firstName" value={form.firstName} onChange={setField} required placeholder="Jane" />
            <Field label="Last Name" name="lastName" value={form.lastName} onChange={setField} required placeholder="Doe" />
          </div>
          <Field label="Main Project" name="project" value={form.project} onChange={setField} required placeholder="Digital Transformation Initiative" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date" name="startDate" value={form.startDate} onChange={setField} type="date" required />
            <Field label="Completion Date" name="completionDate" value={form.completionDate} onChange={setField} type="date" required />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Details
            </label>
            <textarea
              value={form.details}
              onChange={(e) => setField('details', e.target.value)}
              placeholder="A short message about this person's contribution…"
              rows={3}
              className="rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-2 text-sm
                text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400
                focus:ring-1 focus:ring-amber-400/30 transition resize-none"
            />
          </div>

          <Field
            label="Avatar / Image URL (optional)"
            name="imageUrl"
            value={form.imageUrl}
            onChange={setField}
            placeholder="https://example.com/photo.jpg"
          />
          <Field
            label="Recipient Wallet Address"
            name="recipientWallet"
            value={form.recipientWallet}
            onChange={setField}
            required
            placeholder="0x..."
          />

          {/* Status / submit */}
          {mintState.status === 'error' && (
            <div className="rounded-lg bg-red-950/50 border border-red-800 px-4 py-3 text-sm text-red-300">
              {mintState.message}
            </div>
          )}

          {mintState.status === 'success' && (
            <div className="rounded-lg bg-emerald-950/50 border border-emerald-700 px-4 py-3 text-sm text-emerald-300 space-y-1">
              <p className="font-semibold">Badge minted successfully!</p>
              <p>Token ID: <span className="font-mono">{mintState.result.tokenId}</span></p>
              <a
                href={`https://amoy.polygonscan.com/tx/${mintState.result.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block underline hover:text-emerald-200 truncate font-mono text-xs"
              >
                {mintState.result.txHash}
              </a>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700
              disabled:text-slate-500 text-slate-900 font-bold py-3 px-6 text-sm
              transition-colors shadow-lg shadow-amber-900/20"
          >
            {isLoading ? 'Minting…' : 'Mint Badge'}
          </button>
        </form>

        {/* Preview */}
        <div className="lg:sticky lg:top-12">
          <BadgePreview data={form} />
        </div>
      </div>
    </main>
  )
}
