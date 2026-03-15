'use client'

import { useMemo, useState } from 'react'

type GenericRow = Record<string, unknown>

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function CaptionRequestsSection({ rows }: { rows: GenericRow[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const status = asText(row.status).toLowerCase()
      const requester = asText(row.profile_id || row.user_id || row.requester_id).toLowerCase()
      const imageId = asText(row.image_id).toLowerCase()
      return status.includes(q) || requester.includes(q) || imageId.includes(q)
    })
  }, [rows, query])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Caption Requests</h2>
          <p className="text-sm text-slate-500">Queue-style view of caption generation requests.</p>
        </div>
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs" onChange={(event) => setQuery(event.target.value)} placeholder="Filter by status / requester / image" value={query} />
      </div>

      <div className="space-y-3">
        {filtered.map((row, index) => (
          <article key={asText(row.id) || index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Request #{asText(row.id) || 'unknown'}</p>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">{asText(row.status) || 'unknown'}</span>
            </div>
            <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
              <p>Image: {asText(row.image_id) || '—'}</p>
              <p>Requester: {asText(row.profile_id || row.user_id || row.requester_id) || '—'}</p>
              <p>Flavor: {asText(row.flavor_id || row.humor_flavor_id) || '—'}</p>
              <p>Created: {asText(row.created_datetime_utc) || '—'}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
