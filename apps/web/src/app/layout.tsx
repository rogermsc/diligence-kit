import type React from "react"
import type { Metadata } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

// Three faces, each carrying a meaning rather than a mood. Newsreader for
// synthesis a model wrote, Plex Sans for interface chrome, and Plex Mono for
// anything transcribed verbatim out of a document — a quote, a page reference,
// a filename, a figure. Mono is the signal that we did not rephrase it.
//
// Self-hosted at build by next/font, so no external request and no CSP change.
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
})
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
})
const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Diligence Kit - Investment Due Diligence",
  description: "Dashboard for tracking companies under investment due diligence",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} ${display.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
