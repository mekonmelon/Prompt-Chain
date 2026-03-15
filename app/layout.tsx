import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'The Humor Project Admin',
  description: 'Admin panel for The Humor Project'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900">{children}</body>
    </html>
  )
}
