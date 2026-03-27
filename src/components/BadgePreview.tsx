'use client'

import { generateBadgeSvg } from '@/lib/generateSvg'
import type { BadgeFormData } from '@/lib/types'

interface Props {
  data: BadgeFormData
}

export default function BadgePreview({ data }: Props) {
  const svg = generateBadgeSvg(data)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
        Live Preview
      </p>
      <div
        className="rounded-2xl overflow-hidden border border-amber-400/20 shadow-2xl shadow-indigo-950"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-xs text-slate-500 text-center">
        This is exactly what will be minted on-chain.
      </p>
    </div>
  )
}
