'use client'

import { useMemo, useState } from 'react'

type GenericRow = Record<string, unknown>

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function CaptionExamplesSection({ rows }: { rows: GenericRow[] }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 8

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => asText(row.content || row.caption_text || row.example_text).toLowerCase().includes(q))
  }, [rows, query])

  const pageCount = Math.max(Math.ceil(filtered.length / pageSize), 1)
  const current = filtered.slice(page * pageSize, page * pageSize + pageSize)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Caption Examples</h2>
          <p className="text-sm text-slate-500">Reference catalog for exemplar caption quality.</p>
        </div>
        <div className="w-full sm:max-w-xs">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" onChange={(e) => { setQuery(e.target.value); setPage(0) }} placeholder="Search examples (hint: press /)" value={query} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {current.length ? current.map((row, index) => (
          <article key={asText(row.id) || index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="line-clamp-3 text-sm font-semibold text-slate-900">{asText(row.content || row.caption_text || row.example_text) || 'No example text'}</p>
            <div className="mt-2 grid gap-1 text-xs text-slate-600">
              <p>Image: {asText(row.image_id) || '—'}</p>
              <p>Flavor/Theme: {asText(row.flavor_id || row.theme || row.category) || '—'}</p>
              <p>Created: {asText(row.created_datetime_utc) || '—'}</p>
            </div>
          </article>
        )) : <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No examples match this search.</p>}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <p>Page {page + 1} of {pageCount}</p>
        <div className="flex gap-2">
          <button className="rounded bg-slate-200 px-2 py-1 disabled:opacity-50" disabled={page === 0} onClick={() => setPage((p) => Math.max(p - 1, 0))} type="button">Prev</button>
          <button className="rounded bg-slate-200 px-2 py-1 disabled:opacity-50" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(p + 1, pageCount - 1))} type="button">Next</button>
        </div>
      </div>
    </section>
  )
}
