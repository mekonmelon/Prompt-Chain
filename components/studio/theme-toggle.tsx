'use client'

import { useEffect, useState } from 'react'

const THEME_KEY = 'prompt-chain-theme'

type ThemeMode = 'light' | 'dark' | 'system'

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode

  root.dataset.theme = mode
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>('system')

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY) as ThemeMode | null
    const nextTheme: ThemeMode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
    setTheme(nextTheme)
    applyTheme(nextTheme)

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => applyTheme(nextTheme)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  const handleChange = (nextTheme: ThemeMode) => {
    setTheme(nextTheme)
    window.localStorage.setItem(THEME_KEY, nextTheme)
    applyTheme(nextTheme)
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-2 text-xs shadow-sm">
      {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => {
        const active = theme === mode
        return (
          <button
            key={mode}
            type="button"
            onClick={() => handleChange(mode)}
            className={`rounded-full px-3 py-1.5 font-semibold capitalize transition ${
              active
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--panel-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {mode}
          </button>
        )
      })}
    </div>
  )
}
