'use client'

import { useEffect, useRef, useState } from 'react'
import BadgePreview from './BadgePreview'
import type { BadgeFormData, MintState, Network } from '@/lib/types'

type AvatarMode = 'url' | 'upload'

const AVATAR_CANVAS_SIZE = 256
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

const NETWORK_META: Record<
  Network,
  {
    switchLabel: string
  }
> = {
  mainnet: {
    switchLabel: 'Mainnet',
  },
  amoy: {
    switchLabel: 'Testnet',
  },
}

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

  ctx.fillStyle = '#0b1021'
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

function StatusIcon({ success }: { success: boolean }) {
  return success ? (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-emerald-300" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path d="M6.5 10.3L8.7 12.4L13.6 7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-rose-300" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path d="M10 6.5V10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="13.4" r="1" fill="currentColor" />
    </svg>
  )
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
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/58">
        {label} {required && <span className="text-[#f5c06d]">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        required={required}
        className="glass-input px-4 py-3 text-sm [color-scheme:dark]"
      />
      {hint && <p className="text-xs leading-5 text-white/42">{hint}</p>}
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#f5c06d]/82">{title}</span>
            <span className="h-px min-w-12 flex-1 bg-white/10" />
          </div>
          {description ? <p className="max-w-lg text-sm leading-6 text-white/48">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8z" />
    </svg>
  )
}

export default function BadgeMinterPage() {
  const [form, setForm] = useState<BadgeFormData>(EMPTY)
  const [mintState, setMintState] = useState<MintState>({ status: 'idle' })
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('url')
  const [avatarBytes, setAvatarBytes] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const backgroundRef = useRef<HTMLDivElement | null>(null)
  const pointerFrameRef = useRef<number | null>(null)
  const pointerStateRef = useRef({
    x: 0,
    y: 0,
    glowX: 50,
    glowY: 28,
  })

  useEffect(() => {
    return () => {
      if (pointerFrameRef.current !== null) {
        cancelAnimationFrame(pointerFrameRef.current)
      }
    }
  }, [])

  function flushParallax() {
    const node = backgroundRef.current
    if (!node) return

    const { x, y, glowX, glowY } = pointerStateRef.current
    node.style.setProperty('--pointer-x', x.toFixed(3))
    node.style.setProperty('--pointer-y', y.toFixed(3))
    node.style.setProperty('--pointer-glow-x', `${glowX.toFixed(2)}%`)
    node.style.setProperty('--pointer-glow-y', `${glowY.toFixed(2)}%`)
    pointerFrameRef.current = null
  }

  function queueParallax(x: number, y: number, glowX: number, glowY: number) {
    pointerStateRef.current = { x, y, glowX, glowY }

    if (pointerFrameRef.current !== null) return

    pointerFrameRef.current = requestAnimationFrame(flushParallax)
  }

  function setField(name: keyof BadgeFormData, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handlePointerMove(e: React.PointerEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height

    queueParallax((px - 0.5) * 2, (py - 0.5) * 2, px * 100, py * 100)
  }

  function handlePointerLeave() {
    queueParallax(0, 0, 50, 28)
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
      setUploadError('Select an image file to upload.')
      return
    }
    if (!file.type.startsWith('image/')) {
      setUploadError('Only image files are supported.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('Image is larger than 4 MB. Please pick a smaller file.')
      return
    }

    try {
      const { dataUrl, bytes } = await compressAvatar(file)
      setField('imageUrl', dataUrl)
      setAvatarBytes(bytes)
      setUploadError(null)
    } catch (err) {
      console.error(err)
      setUploadError('Unable to process that image. Try another file.')
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
    <main className="relative isolate min-h-screen overflow-hidden" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
      <div ref={backgroundRef} className="parallax-stage pointer-events-none absolute inset-0">
        <div className="parallax-layer-deep absolute inset-0">
          <div className="ambient-grid absolute inset-0" />
        </div>
        <div className="parallax-layer-mid absolute inset-0">
          <div className="hero-vignette absolute inset-0" />
          <div className="pointer-glow absolute inset-0" />
        </div>
        <div className="parallax-layer-soft absolute inset-0">
          <div className="liquid-orb ambient-float absolute -left-24 top-10 h-[28rem] w-[28rem] bg-[radial-gradient(circle,rgba(112,102,255,0.34),transparent_70%)]" />
          <div className="liquid-orb ambient-float absolute right-[-7rem] top-16 h-56 w-56 bg-[radial-gradient(circle,rgba(245,192,109,0.22),transparent_72%)] [animation-delay:-7s]" />
          <div className="liquid-orb ambient-float absolute bottom-16 right-[10%] h-80 w-80 bg-[radial-gradient(circle,rgba(90,214,255,0.13),transparent_70%)] [animation-delay:-11s]" />
          <div className="liquid-card ambient-drift absolute left-[7%] top-24 hidden h-32 w-52 rounded-[28px] lg:block" />
          <div className="liquid-card ambient-drift absolute right-[12%] top-14 hidden h-28 w-28 rounded-full lg:block [animation-delay:-8s]" />
          <div className="liquid-card ambient-drift absolute bottom-28 right-[-2rem] hidden h-24 w-44 rounded-[26px] lg:block [animation-delay:-12s]" />
        </div>
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex justify-center">
          <div className="glass-pill inline-flex items-center gap-2 rounded-full p-1.5 shadow-[0_18px_40px_rgba(3,6,18,0.28)]">
            {(Object.entries(NETWORK_META) as Array<[Network, (typeof NETWORK_META)[Network]]>).map(([value, meta]) => {
              const active = form.network === value

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setField('network', value)}
                  className={`rounded-full px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] transition duration-200 ${
                    active
                      ? 'border border-white/14 bg-white/12 text-white shadow-[0_14px_30px_rgba(8,10,24,0.35)]'
                      : 'text-white/48 hover:text-white/78'
                  }`}
                >
                  {meta.switchLabel}
                </button>
              )
            })}
          </div>
        </div>

        <section className="mx-auto mt-12 flex w-full max-w-5xl flex-col items-center text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.55em] text-white/42">
            ELCA DIGITAL INNOVATION
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
            EDI Badge Minter
          </h1>
          <p className="text-balance mt-5 max-w-lg text-base leading-7 text-white/52 sm:text-lg">Create refined recognition NFTs.</p>
        </section>

        <section className="mt-14 grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] xl:items-start">
          <form onSubmit={handleMint} className="glass-panel rounded-[34px] p-5 sm:p-7 lg:p-8">
            <div className="relative z-10 flex flex-col gap-8">
              <div className="border-b border-white/10 pb-7">
                <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-white">Compose</h2>
              </div>

              <Section title="Recipient">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First Name" name="firstName" value={form.firstName} onChange={setField} required placeholder="Jane" />
                  <Field label="Last Name" name="lastName" value={form.lastName} onChange={setField} required placeholder="Doe" />
                </div>
                <Field
                  label="Recipient Wallet"
                  name="recipientWallet"
                  value={form.recipientWallet}
                  onChange={setField}
                  required
                  placeholder="0x..."
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Start Date" name="startDate" value={form.startDate} onChange={setField} type="date" required />
                  <Field label="Completion Date" name="completionDate" value={form.completionDate} onChange={setField} type="date" required />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/58">Details</label>
                  <textarea
                    value={form.details}
                    onChange={(e) => setField('details', e.target.value)}
                    placeholder="Summarize this person's contribution in a short, high-signal note."
                    rows={4}
                    className="glass-input min-h-[124px] resize-none px-4 py-3 text-sm"
                  />
                </div>

                <div className="flex flex-col gap-3 rounded-[26px] border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/58">Avatar source</p>
                    <div className="glass-pill inline-flex rounded-full p-1">
                      {(['url', 'upload'] as AvatarMode[]).map((mode) => {
                        const active = avatarMode === mode

                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => handleAvatarModeChange(mode)}
                            className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] transition duration-200 ${
                              active ? 'bg-white/12 text-white shadow-[0_10px_24px_rgba(8,10,24,0.3)]' : 'text-white/46 hover:text-white/75'
                            }`}
                          >
                            {mode === 'url' ? 'URL' : 'Upload'}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {avatarMode === 'url' ? (
                    <Field
                      label="Avatar / Image URL"
                      name="imageUrl"
                      value={form.imageUrl}
                      onChange={setField}
                      placeholder="https://example.com/photo.jpg"
                    />
                  ) : (
                    <div className="flex flex-col gap-3 rounded-[22px] border border-white/10 bg-[#090d1b]/44 p-4">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/58">Upload image</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleAvatarUpload(e.target.files)}
                        className="block text-sm text-white/74 file:mr-4 file:rounded-full file:border-0 file:bg-[#f5c06d] file:px-4 file:py-2.5 file:text-xs file:font-semibold file:uppercase file:tracking-[0.22em] file:text-[#111528] hover:file:bg-[#f7ca82]"
                      />
                      <p className="text-xs leading-5 text-white/42">
                        256x256 PNG{avatarBytes ? ` · ${Math.max(1, Math.round(avatarBytes / 1024))} KB` : ''}.
                      </p>
                      {uploadError && <p className="text-xs text-rose-300">{uploadError}</p>}
                    </div>
                  )}

                  {form.imageUrl && (
                    <button type="button" onClick={clearAvatar} className="w-fit text-xs font-medium text-white/54 transition hover:text-white/82">
                      Remove current avatar
                    </button>
                  )}
                </div>
              </Section>

              {mintState.status === 'error' && (
                <div
                  className="flex items-start gap-3 rounded-[24px] border border-rose-400/18 bg-rose-500/[0.07] px-4 py-4 text-sm text-rose-100"
                  aria-live="polite"
                >
                  <StatusIcon success={false} />
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-rose-100">Minting failed</p>
                    <p className="leading-6 text-rose-100/80">{mintState.message}</p>
                  </div>
                </div>
              )}

              {mintState.status === 'success' && (
                <div
                  className="flex flex-col gap-4 rounded-[24px] border border-emerald-400/18 bg-emerald-500/[0.07] px-4 py-4 text-sm text-emerald-50"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-3">
                    <StatusIcon success />
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold text-emerald-100">Badge minted successfully</p>
                      <p className="leading-6 text-emerald-100/72">The transaction is live.</p>
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/54">Token ID</p>
                    <p className="mt-2 font-mono text-sm text-emerald-100">#{mintState.result.tokenId}</p>
                  </div>
                  <a
                    href={`https://${form.network === 'mainnet' ? '' : 'amoy.'}polygonscan.com/tx/${mintState.result.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-fit text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200 transition hover:text-white"
                  >
                    View transaction
                  </a>
                </div>
              )}

              <div className="border-t border-white/10 pt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-[#f5c06d]/30 bg-[linear-gradient(135deg,#f6c574,#f0b757)] px-6 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-[#111528] shadow-[0_24px_40px_rgba(245,192,109,0.24)] transition duration-200 hover:-translate-y-0.5 hover:brightness-[1.03] disabled:translate-y-0 disabled:border-white/10 disabled:bg-white/8 disabled:text-white/36 disabled:shadow-none"
                >
                  {isLoading ? (
                    <>
                      <Spinner />
                      Minting
                    </>
                  ) : (
                    'Mint Badge'
                  )}
                </button>
                <p className="mt-3 text-center text-xs leading-5 text-white/42">
                  Usually confirms in about 15 seconds.
                </p>
              </div>
            </div>
          </form>

          <aside className="flex flex-col gap-5 xl:sticky xl:top-8">
            <div className="glass-panel glass-panel-warm rounded-[34px] p-5 sm:p-6">
              <div className="relative z-10 flex flex-col gap-5">
                <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-white">Preview</h2>
                <BadgePreview data={form} />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
