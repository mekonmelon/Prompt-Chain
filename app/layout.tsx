import type { Metadata } from 'next'
import { ThemeScript } from '@/components/studio/theme-script'
import './globals.css'

export const metadata: Metadata = {
  title: 'Prompt Chain Studio',
  description: 'Prompt-chain builder and testing studio for The Humor Project'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeScript />
        {children}
      </body>
    </html>
  )
}
