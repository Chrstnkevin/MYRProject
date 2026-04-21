import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Elite Global",
  description: "Elite Global — Personal Productivity Dashboard",
  viewport: "width=device-width, initial-scale=1",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}