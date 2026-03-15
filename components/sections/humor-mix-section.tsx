'use client'

type GenericRow = Record<string, unknown>

type ActionState = (formData: FormData) => void | Promise<void>

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function HumorMixSection({ rows, updateHumorMixRow }: { rows: GenericRow[]; updateHumorMixRow: ActionState }) {
  const primary = rows[0]

  if (!primary) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Humor Mix</h2>
        <p className="mt-2 text-sm text-slate-600">No humor mix rows found.</p>
      </section>
    )
  }

  const id = asText(primary.id)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Humor Mix</h2>
        <p className="text-sm text-slate-500">Compact configuration editor for default flavor mix behavior.</p>
      </div>

      <form action={updateHumorMixRow} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <input name="id" type="hidden" value={id} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            Flavor ID
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={asText(primary.flavor_id || primary.humor_flavor_id)} name="flavor_id" />
          </label>
          <label className="text-sm text-slate-700">
            Caption Count
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" defaultValue={asText(primary.caption_count)} name="caption_count" />
          </label>
        </div>

        <label className="text-sm text-slate-700">
          Notes / JSON extension
          <textarea className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs" defaultValue={JSON.stringify(primary, null, 2)} name="payload" rows={6} />
        </label>
        {/* TODO: replace payload textarea with strict field mapping once humor_flavor_mix schema is finalized in shared types. */}

        <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" type="submit">Save Humor Mix</button>
      </form>
    </section>
  )
}
