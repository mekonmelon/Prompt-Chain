'use client'

import { useMemo, useState } from 'react'

type GenericRow = Record<string, unknown>

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function ResponsesSection({ rows }: { rows: GenericRow[] }) {
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const source = [...rows].sort((a, b) => asText(b.created_datetime_utc).localeCompare(asText(a.created_datetime_utc)))
    if (!q) return source
    return source.filter((row) => asText(row.response || row.output || row.content).toLowerCase().includes(q) || asText(row.model_id || row.provider_id).toLowerCase().includes(q))
  }, [rows, query])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Responses Log Viewer</h2>
          <p className="text-sm text-slate-500">Observability feed of model output records.</p>
        </div>
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs" onChange={(e) => setQuery(e.target.value)} placeholder="Filter responses (hint: press /)" value={query} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Created</th>
              <th className="px-3 py-2 font-semibold">Model</th>
              <th className="px-3 py-2 font-semibold">Provider</th>
              <th className="px-3 py-2 font-semibold">Response</th>
              <th className="px-3 py-2 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => {
              const id = asText(row.id) || `row-${idx}`
              const full = asText(row.response || row.output || row.content)
              const expanded = expandedId === id
              return (
                <tr key={id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-600">{asText(row.created_datetime_utc) || '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{asText(row.model_id || row.model) || '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{asText(row.provider_id || row.provider) || '—'}</td>
                  <td className="max-w-[420px] px-3 py-2 text-slate-700">{expanded ? full : `${full.slice(0, 140)}${full.length > 140 ? '…' : ''}`}</td>
                  <td className="px-3 py-2">
                    <button className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300" onClick={() => setExpandedId(expanded ? '' : id)} type="button">{expanded ? 'Collapse' : 'Expand'}</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
