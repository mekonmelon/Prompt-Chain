'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'

type GenericRow = Record<string, unknown>

type ActionState = (formData: FormData) => void | Promise<void>

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function rowId(row: GenericRow) {
  return asText(row.id)
}

function previewUrl(row: GenericRow) {
  return asText(row.url || row.image_url || row.image_src || row.public_url || row.path)
}

export function ImagesSection({
  rows,
  createImageRow,
  updateImageRow,
  deleteImageRow
}: {
  rows: GenericRow[]
  createImageRow: ActionState
  updateImageRow: ActionState
  deleteImageRow: ActionState
}) {
  const [mode, setMode] = useState<'gallery' | 'table'>('gallery')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const url = previewUrl(row).toLowerCase()
      const description = asText(row.image_description || row.description).toLowerCase()
      const profileId = asText(row.profile_id || row.user_id).toLowerCase()
      return url.includes(q) || description.includes(q) || profileId.includes(q)
    })
  }, [rows, query])

  return (
    <section className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Images</h2>
            <p className="text-sm text-slate-500">Gallery + table workflow for image operations.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === 'gallery' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`} onClick={() => setMode('gallery')} type="button">Gallery</button>
            <button className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === 'table' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`} onClick={() => setMode('table')} type="button">Table</button>
          </div>
        </div>

        <form action={createImageRow} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
          <input className="rounded-md border border-slate-300 px-3 py-2" name="url" placeholder="https://image-url" required />
          <input className="rounded-md border border-slate-300 px-3 py-2" name="description" placeholder="image description" />
          <input className="rounded-md border border-slate-300 px-3 py-2" name="profile_id" placeholder="profile_id (optional)" />
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 md:col-span-3" type="submit">
            Add Image
          </button>
        </form>
        {/* TODO: replace URL create flow with Supabase Storage upload once bucket/path conventions are finalized. */}

        <div className="mt-4">
          <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm md:max-w-sm" onChange={(event) => setQuery(event.target.value)} placeholder="Search url, description, or profile" value={query} />
        </div>
      </section>

      {mode === 'gallery' ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row, index) => {
            const id = rowId(row)
            const src = previewUrl(row)
            return (
              <article key={id || index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 h-40 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  {src ? (
                    <Image alt="Image preview" className="h-full w-full object-cover" height={180} src={src} unoptimized width={420} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">No image preview</div>
                  )}
                </div>
                <p className="line-clamp-2 text-sm font-semibold text-slate-900">{asText(row.image_description || row.description) || 'No description'}</p>
                <p className="mt-1 text-xs text-slate-500">ID: {id || 'unknown'}</p>

                <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Edit metadata</summary>
                  <form action={updateImageRow} className="mt-2 space-y-2">
                    <input name="id" type="hidden" value={id} />
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={asText(row.url)} name="url" placeholder="url" />
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={asText(row.image_description || row.description)} name="image_description" placeholder="image_description" />
                    <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={asText(row.profile_id)} name="profile_id" placeholder="profile_id" />
                    <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700" type="submit">Save</button>
                  </form>
                  <form
                    action={deleteImageRow}
                    className="mt-2"
                    onSubmit={(event) => {
                      if (!confirm('Delete this image row? This cannot be undone.')) {
                        event.preventDefault()
                      }
                    }}
                  >
                    <input name="id" type="hidden" value={id} />
                    <button className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700" type="submit">Delete</button>
                  </form>
                </details>
              </article>
            )
          })}
        </section>
      ) : (
        <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Preview</th>
                <th className="px-3 py-2 font-semibold">URL</th>
                <th className="px-3 py-2 font-semibold">Description</th>
                <th className="px-3 py-2 font-semibold">Profile ID</th>
                <th className="px-3 py-2 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, index) => {
                const src = previewUrl(row)
                return (
                  <tr key={rowId(row) || index} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="h-10 w-10 overflow-hidden rounded-md bg-slate-100">
                        {src ? <Image alt="Preview" className="h-full w-full object-cover" height={40} src={src} unoptimized width={40} /> : null}
                      </div>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2 text-slate-700" title={src}>{src || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{asText(row.image_description || row.description) || '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{asText(row.profile_id) || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{asText(row.created_datetime_utc) || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </section>
  )
}
