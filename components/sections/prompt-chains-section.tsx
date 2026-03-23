'use client'

import { useMemo, useState } from 'react'

type GenericRow = Record<string, unknown>

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function chainId(row: GenericRow) {
  return asText(row.id || row.chain_id)
}

export function PromptChainsSection({ rows }: { rows: GenericRow[] }) {
  const [selected, setSelected] = useState(chainId(rows[0] ?? {}))
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => asText(row.name || row.chain_name || row.prompt).toLowerCase().includes(q))
  }, [rows, query])

  const current = filtered.find((row) => chainId(row) === selected) ?? filtered[0]
  const stepCandidates = [current?.step_1, current?.step_2, current?.step_3, current?.step_4, current?.prompt, current?.system_prompt].filter(Boolean)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Prompt Chains</h2>
          <p className="text-sm text-slate-500">Pipeline visualization for chain definitions (read-only).</p>
        </div>
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs" onChange={(e) => setQuery(e.target.value)} placeholder="Search chains (hint: press /)" value={query} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-slate-50 p-2">
          <div className="space-y-1">
            {filtered.map((row, idx) => {
              const id = chainId(row)
              const active = id === chainId(current ?? {})
              return (
                <button key={id || idx} className={`w-full rounded-lg px-3 py-2 text-left ${active ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 hover:bg-slate-100'}`} onClick={() => setSelected(id)} type="button">
                  <p className="text-sm font-semibold">{asText(row.name || row.chain_name) || `Chain ${idx + 1}`}</p>
                  <p className={`text-xs ${active ? 'text-indigo-100' : 'text-slate-500'}`}>Model: {asText(row.model_id || row.model || row.provider_id) || '—'}</p>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="space-y-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Selected Chain</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{asText(current?.name || current?.chain_name) || 'No chain selected'}</h3>
            <p className="mt-1 text-xs text-slate-500">Model: {asText(current?.model_id || current?.model) || '—'}</p>
          </article>

          {(stepCandidates.length ? stepCandidates : [asText(current?.prompt || current?.content)]).map((step, index) => (
            <article key={index} className="relative rounded-xl border border-slate-200 bg-white p-4 pl-10">
              <div className="absolute left-3 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">{index + 1}</div>
              <p className="text-sm font-semibold text-slate-900">Step {index + 1}</p>
              <p className="mt-1 text-sm text-slate-600">{asText(step) || 'No prompt step content found.'}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
