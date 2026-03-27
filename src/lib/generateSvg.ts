import type { BadgeFormData } from './types'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function generateBadgeSvg(data: BadgeFormData): string {
  const name = esc(truncate(`${data.firstName} ${data.lastName}`, 36))
  const project = esc(truncate(data.project, 42))
  const details = esc(truncate(data.details, 90))
  const start = esc(formatDate(data.startDate))
  const end = esc(formatDate(data.completionDate))
  const hasImage = Boolean(data.imageUrl)

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
    width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#fbbf24"/>
    </linearGradient>
    <clipPath id="avatarClip">
      <circle cx="76" cy="196" r="48"/>
    </clipPath>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="600" height="400" fill="url(#bg)" rx="18"/>

  <!-- Outer gold border -->
  <rect x="3" y="3" width="594" height="394" fill="none" stroke="url(#gold)" stroke-width="1.5" rx="16" opacity="0.6"/>

  <!-- Header band -->
  <rect x="0" y="0" width="600" height="64" fill="#f59e0b" fill-opacity="0.08" rx="18"/>
  <rect x="0" y="56" width="600" height="8" fill="#f59e0b" fill-opacity="0.12"/>

  <!-- Header stars & title -->
  <text x="300" y="40" font-family="Georgia, serif" font-size="18" font-weight="bold"
        fill="url(#gold)" text-anchor="middle" filter="url(#glow)">✦  EDI BADGE  ✦</text>
  <text x="300" y="56" font-family="Arial, sans-serif" font-size="10" letter-spacing="3"
        fill="#fbbf24" text-anchor="middle" opacity="0.7">ELCA DIGITAL INNOVATION</text>

  <!-- Avatar circle background -->
  <circle cx="76" cy="196" r="52" fill="#f59e0b" fill-opacity="0.15"/>
  <circle cx="76" cy="196" r="50" fill="none" stroke="url(#gold)" stroke-width="1.5"/>

  ${hasImage
    ? `<image href="${esc(data.imageUrl)}" x="28" y="148" width="96" height="96"
        clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<!-- Placeholder initials -->
  <text x="76" y="203" font-family="Georgia, serif" font-size="28" font-weight="bold"
        fill="url(#gold)" text-anchor="middle" dominant-baseline="middle">
    ${esc((data.firstName[0] ?? '?').toUpperCase())}${esc((data.lastName[0] ?? '').toUpperCase())}
  </text>`}

  <!-- Name -->
  <text x="148" y="168" font-family="Georgia, serif" font-size="22" font-weight="bold"
        fill="white">${name}</text>

  <!-- Project -->
  <text x="148" y="194" font-family="Arial, sans-serif" font-size="13" fill="#fbbf24">
    ${project}
  </text>

  <!-- Divider -->
  <line x1="148" y1="206" x2="560" y2="206" stroke="#f59e0b" stroke-width="0.5" opacity="0.4"/>

  <!-- Dates -->
  <text x="148" y="226" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">
    <tspan fill="#fbbf24" opacity="0.8">From</tspan>  ${start}
    <tspan dx="12" fill="#fbbf24" opacity="0.8">To</tspan>  ${end}
  </text>

  <!-- Details label -->
  <text x="148" y="258" font-family="Arial, sans-serif" font-size="10" letter-spacing="1.5"
        fill="#fbbf24" opacity="0.6">DETAILS</text>

  <!-- Details text (two lines max) -->
  <text x="148" y="275" font-family="Arial, sans-serif" font-size="12" fill="#cbd5e1">
    ${details}
  </text>

  <!-- Polygon badge bottom-right -->
  <text x="572" y="388" font-family="Arial, sans-serif" font-size="9" fill="#6366f1"
        text-anchor="end" opacity="0.8">Polygon Amoy Testnet</text>

  <!-- Decorative corner accents -->
  <path d="M20 20 L36 20 L36 22 L22 22 L22 36 L20 36 Z" fill="#f59e0b" opacity="0.5"/>
  <path d="M580 20 L564 20 L564 22 L578 22 L578 36 L580 36 Z" fill="#f59e0b" opacity="0.5"/>
  <path d="M20 380 L36 380 L36 378 L22 378 L22 364 L20 364 Z" fill="#f59e0b" opacity="0.5"/>
  <path d="M580 380 L564 380 L564 378 L578 378 L578 364 L580 364 Z" fill="#f59e0b" opacity="0.5"/>
</svg>`
}
