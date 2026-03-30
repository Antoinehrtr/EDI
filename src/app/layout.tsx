import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EDI Badge Minter',
  description: 'Mint polished thank-you, farewell, or completion badges as NFTs on Polygon.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#070b17] text-white antialiased selection:bg-amber-300/20 selection:text-white">{children}</body>
    </html>
  )
}
