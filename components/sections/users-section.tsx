'use client'

import { useMemo, useState } from 'react'

type GenericRow = Record<string, unknown>

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function boolBadge(value: unknown) {
  const enabled = value === true
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
      {enabled ? 'Yes' : 'No'}
    </span>
  )
}

export function UsersSection({ rows }: { rows: GenericRow[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const email = asText(row.email).toLowerCase()
      const first = asText(row.first_name).toLowerCase()
      const last = asText(row.last_name).toLowerCase()
      return email.includes(q) || first.includes(q) || last.includes(q)
    })
  }, [rows, query])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Users</h2>
          <p className="text-sm text-slate-500">Read-only directory from public.profiles.</p>
        </div>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email"
          value={query}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Email</th>
              <th className="px-3 py-2 font-semibold">First</th>
              <th className="px-3 py-2 font-semibold">Last</th>
              <th className="px-3 py-2 font-semibold">Superadmin</th>
              <th className="px-3 py-2 font-semibold">In Study</th>
              <th className="px-3 py-2 font-semibold">Matrix Admin</th>
              <th className="px-3 py-2 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => (
              <tr key={asText(row.id) || index} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">{asText(row.email) || '—'}</td>
                <td className="px-3 py-2 text-slate-700">{asText(row.first_name) || '—'}</td>
                <td className="px-3 py-2 text-slate-700">{asText(row.last_name) || '—'}</td>
                <td className="px-3 py-2">{boolBadge(row.is_superadmin)}</td>
                <td className="px-3 py-2">{boolBadge(row.is_in_study)}</td>
                <td className="px-3 py-2">{boolBadge(row.is_matrix_admin)}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{asText(row.created_datetime_utc) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
