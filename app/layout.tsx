import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/theme/theme-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Prompt Chain Studio',
  description: 'Prompt Chain Studio for The Humor Project'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
