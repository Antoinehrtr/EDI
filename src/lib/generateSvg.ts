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
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#06080d"/>
      <stop offset="100%" stop-color="#121821"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#d8dbe2"/>
      <stop offset="100%" stop-color="#9aa3b2"/>
    </linearGradient>
    <radialGradient id="softLight" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="avatarClip">
      <circle cx="86" cy="204" r="48"/>
    </clipPath>
  </defs>

  <rect width="600" height="400" fill="url(#bg)" rx="24"/>
  <circle cx="468" cy="120" r="160" fill="url(#softLight)"/>
  <rect x="14" y="14" width="572" height="372" rx="22" fill="rgba(255,255,255,0.018)" stroke="rgba(255,255,255,0.08)"/>
  <rect x="24" y="24" width="552" height="52" rx="18" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.05)"/>
  <rect x="24" y="88" width="552" height="270" rx="22" fill="rgba(4,7,13,0.3)" stroke="rgba(255,255,255,0.05)"/>

  <text x="40" y="47" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="10" font-weight="600"
        letter-spacing="4" fill="rgba(224,229,238,0.48)">ELCA DIGITAL INNOVATION</text>
  <text x="560" y="47" font-family="'Avenir Next Condensed', 'Arial Narrow', sans-serif" font-size="20" font-weight="700"
        text-anchor="end" fill="url(#accent)">Recognition</text>

  <circle cx="86" cy="204" r="56" fill="rgba(255,255,255,0.025)"/>
  <circle cx="86" cy="204" r="50" fill="rgba(8,11,19,0.68)" stroke="rgba(255,255,255,0.09)"/>

  ${hasImage
    ? `<image href="${esc(data.imageUrl)}" x="38" y="156" width="96" height="96"
        clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<text x="86" y="211" font-family="'Avenir Next Condensed', 'Arial Narrow', sans-serif" font-size="28" font-weight="700"
        fill="url(#accent)" text-anchor="middle" dominant-baseline="middle">
    ${esc((data.firstName[0] ?? '?').toUpperCase())}${esc((data.lastName[0] ?? '').toUpperCase())}
  </text>`}

  <text x="156" y="174" font-family="'Avenir Next Condensed', 'Arial Narrow', sans-serif" font-size="28" font-weight="700"
        fill="#f4f6fb">${name}</text>
  <text x="156" y="200" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="13" font-weight="500"
        fill="#aab2c1">${project}</text>

  <line x1="156" y1="220" x2="540" y2="220" stroke="rgba(255,255,255,0.06)"/>

  <text x="156" y="245" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="10" font-weight="600"
        letter-spacing="2" fill="rgba(205,211,223,0.44)">PERIOD</text>
  <text x="156" y="266" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="12" fill="#c7cfdd">
    ${start}  -  ${end}
  </text>

  <text x="156" y="302" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="10" font-weight="600"
        letter-spacing="2" fill="rgba(205,211,223,0.44)">DETAILS</text>
  <text x="156" y="324" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="13" fill="#dce3ef">
    ${details}
  </text>

  <line x1="40" y1="344" x2="560" y2="344" stroke="rgba(255,255,255,0.05)"/>
</svg>`
}
