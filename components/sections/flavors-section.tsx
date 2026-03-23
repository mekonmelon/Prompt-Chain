'use client'

import { useMemo, useState } from 'react'

type GenericRow = Record<string, unknown>

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function flavorId(row: GenericRow) {
  return asText(row.id || row.flavor_id || row.humor_flavor_id)
}

function stepFlavorId(row: GenericRow) {
  return asText(row.flavor_id || row.humor_flavor_id || row.humor_flavor)
}

function stepOrder(row: GenericRow) {
  const raw = Number(row.step_order ?? row.order_index ?? row.order)
  return Number.isFinite(raw) ? raw : Number.MAX_SAFE_INTEGER
}

export function FlavorsSection({ flavors, steps }: { flavors: GenericRow[]; steps: GenericRow[] }) {
  const [selected, setSelected] = useState<string>(flavorId(flavors[0] ?? {}))

  const activeFlavor = useMemo(() => flavors.find((row) => flavorId(row) === selected) ?? null, [flavors, selected])
  const activeSteps = useMemo(
    () => steps.filter((row) => stepFlavorId(row) === selected).sort((a, b) => stepOrder(a) - stepOrder(b)),
    [steps, selected]
  )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Humor Flavors + Steps</h2>
        <p className="text-sm text-slate-500">Master-detail pipeline view. Select a flavor to inspect its sequence of prompt steps.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-slate-50 p-2">
          <div className="space-y-1">
            {flavors.map((flavor, index) => {
              const id = flavorId(flavor)
              const isActive = selected === id
              return (
                <button
                  key={id || index}
                  className={`w-full rounded-lg px-3 py-2 text-left ${isActive ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 hover:bg-slate-100'}`}
                  onClick={() => setSelected(id)}
                  type="button"
                >
                  <p className="text-sm font-semibold">{asText(flavor.name || flavor.title) || `Flavor ${index + 1}`}</p>
                  <p className={`text-xs ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>ID: {id || 'unknown'}</p>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="space-y-3">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Selected Flavor</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{asText(activeFlavor?.name || activeFlavor?.title) || 'No flavor selected'}</h3>
            <p className="mt-1 text-sm text-slate-600">{asText(activeFlavor?.description || activeFlavor?.notes) || 'No description field available.'}</p>
          </article>

          <div className="space-y-2">
            {activeSteps.length ? (
              activeSteps.map((step, index) => (
                <article key={asText(step.id) || index} className="relative rounded-xl border border-slate-200 bg-white p-4 pl-10">
                  <div className="absolute left-3 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">{index + 1}</div>
                  <p className="text-sm font-semibold text-slate-900">{asText(step.step_title || step.title || step.step_type) || `Step ${index + 1}`}</p>
                  <p className="mt-1 text-sm text-slate-600">{asText(step.step_content || step.prompt || step.content) || 'No step content field available.'}</p>
                  <p className="mt-1 text-xs text-slate-500">Order: {asText(step.step_order || step.order_index || step.order) || '—'}</p>
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No steps found for the selected flavor.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
