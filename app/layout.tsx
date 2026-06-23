import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Hanken_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains' })
const hanken = Hanken_Grotesk({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-hanken' })

export const metadata: Metadata = {
  metadataBase: new URL('https://tryoutloud.app'),
  title: 'Outloud AI | Turn Ships into Posts',
  description:
    'Outloud captures your voice and turns code updates and build-in-public logs into high-signal X posts and witty replies — not generic AI slop.',
  openGraph: {
    title: 'Outloud — post in your own voice',
    description: 'An AI copilot that writes your posts in your real voice, not generic AI slop.',
    url: 'https://tryoutloud.app',
    images: ['https://tryoutloud.app/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Outloud — post in your own voice',
    description: 'An AI copilot that writes your posts in your real voice, not generic AI slop.',
    images: ['https://tryoutloud.app/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrains.variable} ${hanken.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="selection:bg-electric-indigo selection:text-white">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
