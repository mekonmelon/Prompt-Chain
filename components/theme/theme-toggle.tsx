'use client'

import { useTheme } from '@/components/theme/theme-provider'

const OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' }
] as const

export function ThemeToggle() {
  const { mode, setMode, resolvedTheme } = useTheme()

  return (
    <div className="rounded-full border border-slate-700/70 bg-slate-900/70 p-1 text-xs text-slate-200 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 light:border-slate-300">
      <div className="mb-1 px-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">Theme · {resolvedTheme}</div>
      <div className="flex gap-1">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className={`rounded-full px-3 py-1.5 transition ${
              mode === option.value ? 'bg-violet-500 text-white' : 'bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
