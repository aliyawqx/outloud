import type { Metadata } from 'next'
import { Space_Grotesk, Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
})
const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-sans',
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  title: 'Outloud — ship in public, in your voice',
  description:
    'Outloud turns what you ship into X posts that sound like you — approved in 30 seconds, posted, measured. Build in public, stay consistent, get known.',
  openGraph: {
    title: 'Outloud — ship in public, in your voice',
    description:
      'Outloud turns what you ship into X posts that sound like you — approved in 30 seconds, posted, measured.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
