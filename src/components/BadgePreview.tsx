'use client'

import { generateBadgeSvg } from '@/lib/generateSvg'
import type { BadgeFormData } from '@/lib/types'

interface Props {
  data: BadgeFormData
}

export default function BadgePreview({ data }: Props) {
  const svg = generateBadgeSvg(data)

  return (
    <div>
      <div className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[#04070e]/84 p-3 shadow-[0_34px_90px_rgba(0,0,0,0.56)] backdrop-blur-[24px]">
        <div className="pointer-events-none absolute inset-x-5 top-3 h-px surface-line ambient-shimmer opacity-60" />
        <div
          className="relative overflow-hidden rounded-[22px] border border-white/8 bg-[#05070d]/88 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  )
}
