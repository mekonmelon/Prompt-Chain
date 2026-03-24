'use client'

import { useMemo, useState } from 'react'
import {
  asText,
  CAPTION_FLAVOR_KEYS,
  CAPTION_TEXT_KEYS,
  extractPromptVariables,
  FLAVOR_ACTIVE_KEYS,
  FLAVOR_UPDATED_KEYS,
  GenericRow,
  getFlavorDescription,
  getFlavorId,
  getFlavorName,
  getFlavorSlug,
  getRowId,
  getStepFlavorId,
  getStepOrder,
  IMAGE_URL_KEYS,
  normalizeApiCaptions,
  pickFirstKey,
  pickFirstValue,
  sortSteps,
  STEP_ACTIVE_KEYS,
  STEP_BODY_KEYS,
  STEP_INPUT_TYPE_KEYS,
  STEP_MODEL_KEYS,
  STEP_ORDER_KEYS,
  STEP_OUTPUT_TYPE_KEYS,
  STEP_SYSTEM_PROMPT_KEYS,
  STEP_TEMPERATURE_KEYS,
  STEP_TITLE_KEYS,
  STEP_USER_PROMPT_KEYS
} from '@/lib/prompt-chain'

type ActionProp = (formData: FormData) => void | Promise<void>

type Feedback = {
  message: string
  scope: string
  type: 'success' | 'error'
}

type Props = {
  selectedView: string
  initialSelectedFlavorId?: string
  feedback?: Feedback | null
  flavors: GenericRow[]
  steps: GenericRow[]
  images: GenericRow[]
  captions: GenericRow[]
  mixes: GenericRow[]
  promptChains: GenericRow[]
  responses: GenericRow[]
  createFlavor: ActionProp
  updateFlavor: ActionProp
  deleteFlavor: ActionProp
  duplicateFlavor: ActionProp
  createStep: ActionProp
  updateStep: ActionProp
  deleteStep: ActionProp
  reorderStep: ActionProp
}

function badge(text: string, tone = 'default') {
  const tones: Record<string, string> = {
    default: 'border-[var(--panel-border)] bg-[var(--panel-muted)] text-[var(--muted-foreground)]',
    accent: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200 dark:text-indigo-200',
    success: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
  }

  return <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${tones[tone] ?? tones.default}`}>{text}</span>
}

function formatDate(value: unknown) {
  const text = asText(value)
  if (!text) return '—'
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return text
  return parsed.toLocaleString()
}

function getCaptionFlavorId(row: GenericRow) {
  return asText(pickFirstValue(row, CAPTION_FLAVOR_KEYS))
}

function getCaptionText(row: GenericRow) {
  return asText(pickFirstValue(row, CAPTION_TEXT_KEYS))
}

function getImageUrl(row: GenericRow) {
  return asText(pickFirstValue(row, IMAGE_URL_KEYS))
}

function getBooleanState(row: GenericRow, keys: readonly string[]) {
  const value = pickFirstValue(row, keys)
  return value === false ? 'Inactive' : 'Active'
}

function groupTitle(selectedView: string) {
  switch (selectedView) {
    case 'overview':
      return 'Overview'
    case 'flavors':
      return 'Flavor Builder'
    case 'steps':
      return 'Ordered Steps'
    case 'test-runner':
      return 'Test Runner'
    case 'results':
      return 'Results / Captions'
    case 'audit':
      return 'Audit Trail'
    default:
      return 'Prompt Chain Studio'
  }
}

export function PromptChainStudioSection({
  selectedView,
  initialSelectedFlavorId,
  feedback,
  flavors,
  steps,
  images,
  captions,
  mixes,
  promptChains,
  responses,
  createFlavor,
  updateFlavor,
  deleteFlavor,
  duplicateFlavor,
  createStep,
  updateStep,
  deleteStep,
  reorderStep
}: Props) {
  const [query, setQuery] = useState('')
  const [selectedFlavorId, setSelectedFlavorId] = useState(initialSelectedFlavorId || getFlavorId(flavors[0] ?? {}))
  const [testImageId, setTestImageId] = useState(asText(images[0]?.id))
  const [isRunningTest, setIsRunningTest] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testPayload, setTestPayload] = useState<string>('')
  const [generatedCaptions, setGeneratedCaptions] = useState<ReturnType<typeof normalizeApiCaptions>>([])

  const flavorUpdatedKey = useMemo(() => pickFirstKey(flavors, FLAVOR_UPDATED_KEYS), [flavors])
  const flavorActiveKey = useMemo(() => pickFirstKey(flavors, FLAVOR_ACTIVE_KEYS), [flavors])

  const stepOrderKey = useMemo(() => pickFirstKey(steps, STEP_ORDER_KEYS), [steps])
  const stepTitleKey = useMemo(() => pickFirstKey(steps, STEP_TITLE_KEYS), [steps])
  const stepBodyKey = useMemo(() => pickFirstKey(steps, STEP_BODY_KEYS), [steps])
  const stepSystemPromptKey = useMemo(() => pickFirstKey(steps, STEP_SYSTEM_PROMPT_KEYS), [steps])
  const stepUserPromptKey = useMemo(() => pickFirstKey(steps, STEP_USER_PROMPT_KEYS), [steps])
  const stepInputTypeKey = useMemo(() => pickFirstKey(steps, STEP_INPUT_TYPE_KEYS), [steps])
  const stepOutputTypeKey = useMemo(() => pickFirstKey(steps, STEP_OUTPUT_TYPE_KEYS), [steps])
  const stepTemperatureKey = useMemo(() => pickFirstKey(steps, STEP_TEMPERATURE_KEYS), [steps])
  const stepModelKey = useMemo(() => pickFirstKey(steps, STEP_MODEL_KEYS), [steps])
  const stepActiveKey = useMemo(() => pickFirstKey(steps, STEP_ACTIVE_KEYS), [steps])

  const filteredFlavors = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return flavors
    return flavors.filter((row) => [getFlavorName(row), getFlavorDescription(row), getFlavorId(row)].join(' ').toLowerCase().includes(q))
  }, [flavors, query])

  const activeFlavor = useMemo(() => {
    return filteredFlavors.find((row) => getFlavorId(row) === selectedFlavorId) ?? flavors.find((row) => getFlavorId(row) === selectedFlavorId) ?? filteredFlavors[0] ?? flavors[0] ?? null
  }, [filteredFlavors, flavors, selectedFlavorId])

  const activeFlavorId = getFlavorId(activeFlavor ?? {})
  const activeSteps = useMemo(() => sortSteps(steps.filter((row) => getStepFlavorId(row) === activeFlavorId)), [activeFlavorId, steps])
  const recentFlavor = useMemo(() => [...flavors].sort((a, b) => formatDate(pickFirstValue(b, FLAVOR_UPDATED_KEYS)).localeCompare(formatDate(pickFirstValue(a, FLAVOR_UPDATED_KEYS))))[0], [flavors])
  const promptVariables = useMemo(() => extractPromptVariables([...activeSteps, ...promptChains]), [activeSteps, promptChains])
  const imageById = useMemo(() => new Map(images.map((row) => [getRowId(row), getImageUrl(row)])), [images])

  const recentCaptions = useMemo(() => {
    const scoped = activeFlavorId ? captions.filter((row) => getCaptionFlavorId(row) === activeFlavorId) : captions
    return scoped.slice(0, 12)
  }, [activeFlavorId, captions])

  const mixSummary = useMemo(() => {
    return mixes.find((row) => asText(row.flavor_id || row.humor_flavor_id) === activeFlavorId) ?? null
  }, [activeFlavorId, mixes])

  const handleRunTest = async () => {
    setIsRunningTest(true)
    setTestError(null)
    setGeneratedCaptions([])

    try {
      const payload = {
        flavorId: activeFlavorId,
        imageId: testImageId,
        imageUrl: imageById.get(testImageId) ?? '',
        imageSource: 'images'
      }

      setTestPayload(JSON.stringify(payload, null, 2))

      const response = await fetch('/api/prompt-chain-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const rawText = await response.text()
      let parsed: unknown = null

      try {
        parsed = rawText ? JSON.parse(rawText) : null
      } catch {
        parsed = { rawText }
      }

      if (!response.ok) {
        const errorText = typeof parsed === 'object' && parsed && 'errorText' in parsed ? asText((parsed as Record<string, unknown>).errorText) : rawText
        setTestError(errorText || 'Prompt-chain test failed.')
        return
      }

      const normalized = normalizeApiCaptions(parsed)
      setGeneratedCaptions(normalized)
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Prompt-chain test failed before the API responded.')
    } finally {
      setIsRunningTest(false)
    }
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <aside className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
          <div className="rounded-2xl border border-indigo-500/20 bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(15,23,42,0.06))] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300">Prompt Chain Studio</p>
            <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">{groupTitle(selectedView)}</h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">A focused builder for humor flavors, ordered prompt steps, and live caption testing.</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Flavors</p>
              <p className="mt-2 text-3xl font-bold">{flavors.length}</p>
            </article>
            <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Steps</p>
              <p className="mt-2 text-3xl font-bold">{steps.length}</p>
            </article>
            <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Recently Updated</p>
              <p className="mt-2 text-sm font-semibold">{recentFlavor ? getFlavorName(recentFlavor) : 'No flavors loaded'}</p>
            </article>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Flavor Library</h3>
              {badge(`${filteredFlavors.length} visible`, 'accent')}
            </div>
            <input
              className="mt-3 w-full rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-sm outline-none ring-0 placeholder:text-[var(--muted-foreground)]"
              placeholder="Search flavors"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
              {filteredFlavors.map((flavor) => {
                const id = getFlavorId(flavor)
                const active = id === activeFlavorId
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedFlavorId(id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? 'border-indigo-400/40 bg-indigo-500/10 shadow-sm'
                        : 'border-[var(--panel-border)] bg-[var(--panel)] hover:border-indigo-300/30 hover:bg-[var(--panel-muted)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{getFlavorName(flavor)}</p>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)] line-clamp-2">{getFlavorDescription(flavor) || 'No description column detected for this flavor row.'}</p>
                      </div>
                      {flavorActiveKey ? badge(getBooleanState(flavor, [flavorActiveKey]), flavor[flavorActiveKey] === false ? 'default' : 'success') : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <div className="grid gap-6">
          {feedback?.message ? (
            <div className={`rounded-2xl border p-4 text-sm ${feedback.type === 'success' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-400/30 bg-rose-500/10 text-rose-200'}`}>
              <p className="font-semibold">{feedback.type === 'success' ? 'Success' : 'Action failed'}</p>
              <p className="mt-1 whitespace-pre-wrap">{feedback.message}</p>
            </div>
          ) : null}
          {selectedView === 'overview' ? (
            <>
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <article className="rounded-3xl border border-[var(--panel-border)] bg-[linear-gradient(135deg,rgba(99,102,241,0.16),rgba(139,92,246,0.08))] p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300">Humor flavors</p>
                  <h3 className="mt-3 text-3xl font-bold text-[var(--foreground)]">Prompt chains for caption style, tone, and sequencing.</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">Each humor flavor is treated as an ordered chain of steps. This studio keeps flavor metadata, chain sequencing, test execution, and generated caption review in one workspace instead of spreading them across raw tables.</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white" href="/?view=flavors">Create flavor</a>
                    <a className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2 text-sm font-semibold" href="/?view=test-runner">Test flavor</a>
                  </div>
                </article>

                <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Selected flavor</p>
                  <h3 className="mt-3 text-2xl font-bold">{activeFlavor ? getFlavorName(activeFlavor) : 'No flavor selected'}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{activeFlavor ? getFlavorDescription(activeFlavor) || 'No description field detected for the selected flavor.' : 'Choose a flavor from the library to inspect its step chain.'}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {badge(`${activeSteps.length} ordered steps`, 'accent')}
                    {mixSummary ? badge(`Mix row linked`, 'success') : badge('No mix row linked')}
                    {activeFlavor && flavorUpdatedKey ? badge(`Updated ${formatDate(activeFlavor[flavorUpdatedKey])}`) : null}
                  </div>
                </article>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">Step chain preview</h3>
                      <p className="text-sm text-[var(--muted-foreground)]">Ordered pipeline view for the currently selected flavor.</p>
                    </div>
                    <a href="/?view=steps" className="text-sm font-semibold text-indigo-400">Open step editor →</a>
                  </div>
                  <div className="mt-4 space-y-3">
                    {activeSteps.length ? activeSteps.map((step, index) => (
                      <div key={getRowId(step) || index} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">{index + 1}</div>
                            <div>
                              <p className="text-sm font-semibold">{asText(stepTitleKey ? step[stepTitleKey] : `Step ${index + 1}`) || `Step ${index + 1}`}</p>
                              <p className="text-xs text-[var(--muted-foreground)]">Order value: {getStepOrder(step)}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {stepInputTypeKey && asText(step[stepInputTypeKey]) ? badge(`In: ${asText(step[stepInputTypeKey])}`) : null}
                            {stepOutputTypeKey && asText(step[stepOutputTypeKey]) ? badge(`Out: ${asText(step[stepOutputTypeKey])}`) : null}
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{asText(stepBodyKey ? step[stepBodyKey] : '') || 'No step instruction/content field detected.'}</p>
                      </div>
                    )) : <p className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-muted)] p-4 text-sm text-[var(--muted-foreground)]">No steps loaded for the selected flavor yet.</p>}
                  </div>
                </article>

                <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                  <h3 className="text-lg font-semibold">Prompt variable reference</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">Variables are only listed when they were detected in existing stored prompts or chain rows, so this panel does not invent unsupported placeholders.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {promptVariables.length ? promptVariables.map((variable) => badge(variable, 'accent')) : badge('No ${...} variables detected in current records')}
                  </div>
                  <div className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4 text-sm text-[var(--muted-foreground)]">
                    <p className="font-semibold text-[var(--foreground)]">Schema-aware editing rule</p>
                    <p className="mt-2">Only fields already present in the loaded schema are shown as structured inputs. If a field is absent from current rows, the studio intentionally avoids guessing it.</p>
                  </div>
                </article>
              </div>
            </>
          ) : null}

          {selectedView === 'flavors' ? (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Create a new humor flavor</h3>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">This form only writes detected metadata columns plus the required audit-user fields.</p>
                <form action={createFlavor} className="mt-4 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm">
                      <span className="font-medium">Slug</span>
                      <input name="slug" required className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2" placeholder="e.g. dry-observational" />
                    </label>
                    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-4 py-3 text-sm text-[var(--muted-foreground)]">Rows in <code>humor_flavors</code> use <code>slug</code> and <code>description</code> instead of a dedicated name column.</div>
                  </div>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Description</span>
                    <textarea name="description" required rows={4} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2" placeholder="Describe tone, style, or workflow intent." />
                  </label>
                  <button type="submit" className="w-fit rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white">Create flavor</button>
                </form>
              </article>

              <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Flavor detail panel</h3>
                    <p className="text-sm text-[var(--muted-foreground)]">Searchable master/detail editing without flattening the UI into a giant table.</p>
                  </div>
                  {activeFlavor ? badge(getFlavorSlug(activeFlavor) || `ID ${activeFlavorId}`) : null}
                </div>

                {activeFlavor ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
                      <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Last modified</p>
                      <p className="mt-2 text-sm font-semibold">{flavorUpdatedKey ? formatDate(activeFlavor[flavorUpdatedKey]) : 'No update timestamp column detected'}</p>
                      <p className="mt-2 text-xs text-[var(--muted-foreground)]">Slug: {getFlavorSlug(activeFlavor) || '—'}</p>
                    </div>

                    <form action={updateFlavor} className="grid gap-4">
                      <input type="hidden" name="id" value={activeFlavorId} />
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Slug</span>
                        <input name="slug" required defaultValue={getFlavorSlug(activeFlavor)} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2" />
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span className="font-medium">Description</span>
                        <textarea name="description" required rows={4} defaultValue={getFlavorDescription(activeFlavor)} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2" />
                      </label>
                      <button type="submit" className="w-fit rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white">Save flavor changes</button>
                    </form>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
                        <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Step summary</p>
                        <p className="mt-2 text-2xl font-bold">{activeSteps.length}</p>
                      </div>
                      <form action={duplicateFlavor}>
                        <input type="hidden" name="id" value={activeFlavorId} />
                        <button type="submit" className="h-full w-full rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-4 text-left transition hover:bg-indigo-500/20">
                          <p className="text-xs uppercase tracking-wide text-indigo-300">Duplicate</p>
                          <p className="mt-2 text-sm font-semibold">Create a copy of this flavor and its loaded steps.</p>
                        </button>
                      </form>
                      <form action={deleteFlavor}>
                        <input type="hidden" name="id" value={activeFlavorId} />
                        <button type="submit" className="h-full w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-left transition hover:bg-rose-500/20">
                          <p className="text-xs uppercase tracking-wide text-rose-300">Delete</p>
                          <p className="mt-2 text-sm font-semibold">Remove the flavor row. Existing RLS/foreign-key rules still apply.</p>
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-muted)] p-4 text-sm text-[var(--muted-foreground)]">Choose a flavor from the left library to edit its metadata.</p>
                )}
              </article>
            </div>
          ) : null}

          {selectedView === 'steps' ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Ordered step editor</h3>
                    <p className="text-sm text-[var(--muted-foreground)]">Move steps up/down for stable ordering without introducing a brittle drag/drop dependency.</p>
                  </div>
                  {activeFlavor ? badge(getFlavorName(activeFlavor), 'accent') : null}
                </div>

                <div className="mt-4 space-y-4">
                  {activeSteps.map((step, index) => (
                    <div key={getRowId(step) || index} className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">{index + 1}</div>
                          <div>
                            <p className="text-sm font-semibold">{asText(stepTitleKey ? step[stepTitleKey] : `Step ${index + 1}`) || `Step ${index + 1}`}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {stepInputTypeKey && asText(step[stepInputTypeKey]) ? badge(`Input ${asText(step[stepInputTypeKey])}`) : null}
                              {stepOutputTypeKey && asText(step[stepOutputTypeKey]) ? badge(`Output ${asText(step[stepOutputTypeKey])}`) : null}
                              {stepModelKey && asText(step[stepModelKey]) ? badge(`Model ${asText(step[stepModelKey])}`) : null}
                              {stepActiveKey ? badge(getBooleanState(step, [stepActiveKey])) : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <form action={reorderStep}>
                            <input type="hidden" name="id" value={getRowId(step)} />
                        <input type="hidden" name="return_flavor_id" value={activeFlavorId} />
                            <input type="hidden" name="direction" value="up" />
                            <button disabled={index === 0} type="submit" className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Move up</button>
                          </form>
                          <form action={reorderStep}>
                            <input type="hidden" name="id" value={getRowId(step)} />
                            <input type="hidden" name="return_flavor_id" value={activeFlavorId} />
                            <input type="hidden" name="direction" value="down" />
                            <button disabled={index === activeSteps.length - 1} type="submit" className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Move down</button>
                          </form>
                        </div>
                      </div>

                      <form action={updateStep} className="mt-4 grid gap-3">
                        <input type="hidden" name="id" value={getRowId(step)} />
                        <input type="hidden" name="return_flavor_id" value={activeFlavorId} />
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="grid gap-2 text-sm">
                            <span className="font-medium">Step title</span>
                            <input name="step_title" defaultValue={asText(stepTitleKey ? step[stepTitleKey] : '')} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" />
                          </label>
                          {stepOrderKey ? (
                            <label className="grid gap-2 text-sm">
                              <span className="font-medium">Order</span>
                              <input name="step_order" type="number" defaultValue={String(getStepOrder(step))} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" />
                            </label>
                          ) : null}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {stepInputTypeKey ? <label className="grid gap-2 text-sm"><span className="font-medium">Input type</span><input name="input_type" defaultValue={asText(step[stepInputTypeKey])} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" /></label> : null}
                          {stepOutputTypeKey ? <label className="grid gap-2 text-sm"><span className="font-medium">Output type</span><input name="output_type" defaultValue={asText(step[stepOutputTypeKey])} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" /></label> : null}
                          {stepTemperatureKey ? <label className="grid gap-2 text-sm"><span className="font-medium">Temperature</span><input name="temperature" type="number" step="0.1" defaultValue={asText(step[stepTemperatureKey])} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" /></label> : null}
                          {stepModelKey ? <label className="grid gap-2 text-sm"><span className="font-medium">Model / provider link</span><input name="model_link" defaultValue={asText(step[stepModelKey])} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" /></label> : null}
                        </div>
                        {stepBodyKey ? <label className="grid gap-2 text-sm"><span className="font-medium">Step instructions</span><textarea name="step_body" rows={4} defaultValue={asText(step[stepBodyKey])} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" /></label> : null}
                        {stepSystemPromptKey ? <label className="grid gap-2 text-sm"><span className="font-medium">System prompt</span><textarea name="system_prompt" rows={4} defaultValue={asText(step[stepSystemPromptKey])} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" /></label> : null}
                        {stepUserPromptKey ? <label className="grid gap-2 text-sm"><span className="font-medium">User prompt</span><textarea name="user_prompt" rows={4} defaultValue={asText(step[stepUserPromptKey])} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2" /></label> : null}
                        {stepActiveKey ? <label className="flex items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm"><input name="is_active" type="checkbox" defaultChecked={step[stepActiveKey] !== false} /> Enabled</label> : null}
                        <div className="flex flex-wrap gap-3">
                          <button type="submit" className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">Save step</button>
                        </div>
                      </form>
                      <form action={deleteStep} className="mt-3">
                        <input type="hidden" name="id" value={getRowId(step)} />
                        <input type="hidden" name="return_flavor_id" value={activeFlavorId} />
                        <button type="submit" className="rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300">Delete step</button>
                      </form>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Add a new step</h3>
                <p className="mt-2 text-sm text-[var(--muted-foreground)]">The form surfaces schema-backed fields only. If a column does not exist in loaded rows, it stays omitted instead of guessed.</p>
                {activeFlavor ? (
                  <form action={createStep} className="mt-4 grid gap-3">
                    <input type="hidden" name="flavor_id" value={activeFlavorId} />
                    <label className="grid gap-2 text-sm"><span className="font-medium">Step title</span><input name="step_title" className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2" /></label>
                    {stepBodyKey ? <label className="grid gap-2 text-sm"><span className="font-medium">Step instructions</span><textarea name="step_body" rows={4} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2" /></label> : null}
                    {stepSystemPromptKey ? <label className="grid gap-2 text-sm"><span className="font-medium">System prompt</span><textarea name="system_prompt" rows={4} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2" /></label> : null}
                    {stepUserPromptKey ? <label className="grid gap-2 text-sm"><span className="font-medium">User prompt</span><textarea name="user_prompt" rows={4} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2" /></label> : null}
                    <div className="grid gap-3 md:grid-cols-2">
                      {stepInputTypeKey ? <label className="grid gap-2 text-sm"><span className="font-medium">Input type</span><input name="input_type" className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2" /></label> : null}
                      {stepOutputTypeKey ? <label className="grid gap-2 text-sm"><span className="font-medium">Output type</span><input name="output_type" className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2" /></label> : null}
                      {stepTemperatureKey ? <label className="grid gap-2 text-sm"><span className="font-medium">Temperature</span><input name="temperature" type="number" step="0.1" className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2" /></label> : null}
                      {stepModelKey ? <label className="grid gap-2 text-sm"><span className="font-medium">Model / provider link</span><input name="model_link" className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2" /></label> : null}
                    </div>
                    {stepActiveKey ? <label className="flex items-center gap-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-4 py-3 text-sm"><input name="is_active" type="checkbox" defaultChecked /> Enabled</label> : null}
                    <button type="submit" className="w-fit rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white">Add step</button>
                  </form>
                ) : (
                  <p className="mt-4 rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-muted)] p-4 text-sm text-[var(--muted-foreground)]">Select or create a flavor before adding steps.</p>
                )}

                <div className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4 text-sm text-[var(--muted-foreground)]">
                  <p className="font-semibold text-[var(--foreground)]">Variable helper</p>
                  <p className="mt-2">Detected prompt variables in current chain data:</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {promptVariables.length ? promptVariables.map((variable) => badge(variable, 'accent')) : badge('No variables detected')}
                  </div>
                </div>
              </article>
            </div>
          ) : null}

          {selectedView === 'test-runner' ? (
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Flavor test runner</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">This runner sends the selected flavor and image source through a configurable REST endpoint. It preserves backend error text verbatim when the upstream call fails.</p>
                <div className="mt-4 grid gap-4">
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Selected flavor</span>
                    <select value={activeFlavorId} onChange={(event) => setSelectedFlavorId(event.target.value)} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2">
                      {flavors.map((flavor) => <option key={getFlavorId(flavor)} value={getFlavorId(flavor)}>{getFlavorName(flavor)}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="font-medium">Image source</span>
                    <select value={testImageId} onChange={(event) => setTestImageId(event.target.value)} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] px-3 py-2">
                      {images.map((image) => <option key={getRowId(image)} value={getRowId(image)}>{getRowId(image)} {getImageUrl(image) ? '· image row' : ''}</option>)}
                    </select>
                  </label>
                  <button disabled={!activeFlavorId || !testImageId || isRunningTest} onClick={handleRunTest} type="button" className="w-fit rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{isRunningTest ? 'Running test…' : 'Run prompt chain test'}</button>
                </div>

                <div className="mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Debug request payload</p>
                  <pre className="mt-3 overflow-auto text-xs leading-6 text-[var(--muted-foreground)]">{testPayload || 'Select a flavor and image, then run a test.'}</pre>
                </div>
                {testError ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200 whitespace-pre-wrap">{testError}</div> : null}
              </article>

              <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Generated captions</h3>
                    <p className="text-sm text-[var(--muted-foreground)]">Cards are normalized from the REST response shape when captions are returned.</p>
                  </div>
                  {badge(`${generatedCaptions.length} results`, 'accent')}
                </div>
                <div className="mt-4 space-y-3">
                  {generatedCaptions.length ? generatedCaptions.map((result) => (
                    <div key={result.id} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{result.caption || 'No caption text field returned.'}</p>
                          <p className="mt-2 text-xs text-[var(--muted-foreground)]">Flavor: {result.flavorId || activeFlavorId || '—'} · Created: {formatDate(result.createdAt)}</p>
                        </div>
                        {(result.imageUrl || imageById.get(testImageId)) ? <a href={result.imageUrl || imageById.get(testImageId)} target="_blank" className="text-xs font-semibold text-indigo-400" rel="noreferrer">Open image</a> : null}
                      </div>
                      <details className="mt-3 text-xs text-[var(--muted-foreground)]">
                        <summary className="cursor-pointer font-semibold">Raw response item</summary>
                        <pre className="mt-2 overflow-auto leading-6">{JSON.stringify(result.raw, null, 2)}</pre>
                      </details>
                    </div>
                  )) : <p className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-muted)] p-4 text-sm text-[var(--muted-foreground)]">No generated captions yet. Configure the REST endpoint and run a test.</p>}
                </div>
              </article>
            </div>
          ) : null}

          {selectedView === 'results' ? (
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Recent captions for selected flavor</h3>
                    <p className="text-sm text-[var(--muted-foreground)]">Read-only inspection view tied to the currently selected flavor where caption flavor fields were detectable.</p>
                  </div>
                  {activeFlavor ? badge(getFlavorName(activeFlavor), 'accent') : null}
                </div>
                <div className="mt-4 space-y-3">
                  {recentCaptions.length ? recentCaptions.map((caption) => {
                    const imageUrl = imageById.get(asText(caption.image_id))
                    return (
                      <div key={getRowId(caption)} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold leading-6">{getCaptionText(caption) || 'No caption text field detected.'}</p>
                            <p className="mt-2 text-xs text-[var(--muted-foreground)]">Created {formatDate(caption.created_datetime_utc || caption.created_at)} · Flavor {getCaptionFlavorId(caption) || 'not stored on row'}</p>
                          </div>
                          {imageUrl ? <a href={imageUrl} target="_blank" className="text-xs font-semibold text-indigo-400" rel="noreferrer">Preview image</a> : null}
                        </div>
                      </div>
                    )
                  }) : <p className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-muted)] p-4 text-sm text-[var(--muted-foreground)]">No recent captions matched the selected flavor using the currently detectable flavor-id columns.</p>}
                </div>
              </article>

              <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                <h3 className="text-lg font-semibold">Result context</h3>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Mix defaults</p>
                    <pre className="mt-2 overflow-auto text-xs leading-6 text-[var(--muted-foreground)]">{mixSummary ? JSON.stringify(mixSummary, null, 2) : 'No humor_flavor_mix row matched the selected flavor.'}</pre>
                  </div>
                  <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Audit references</p>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">Use the Audit Trail workspace to inspect recent llm_prompt_chains and llm_model_responses that may explain how a caption was produced.</p>
                  </div>
                </div>
              </article>
            </div>
          ) : null}

          {selectedView === 'audit' ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">llm_prompt_chains</h3>
                  {badge(`${promptChains.length} loaded`, 'accent')}
                </div>
                <div className="mt-4 space-y-3">
                  {promptChains.slice(0, 10).map((row) => (
                    <div key={getRowId(row)} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
                      <p className="text-sm font-semibold">{asText(row.name || row.chain_name || row.id)}</p>
                      <p className="mt-2 text-xs text-[var(--muted-foreground)]">Created {formatDate(row.created_datetime_utc || row.created_at)}</p>
                      <pre className="mt-3 overflow-auto text-xs leading-6 text-[var(--muted-foreground)]">{JSON.stringify(row, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">llm_model_responses</h3>
                  {badge(`${responses.length} loaded`, 'accent')}
                </div>
                <div className="mt-4 space-y-3">
                  {responses.slice(0, 10).map((row) => (
                    <div key={getRowId(row)} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-muted)] p-4">
                      <p className="text-sm font-semibold">Response {asText(row.id)}</p>
                      <p className="mt-2 text-xs text-[var(--muted-foreground)]">Created {formatDate(row.created_datetime_utc || row.created_at)}</p>
                      <pre className="mt-3 overflow-auto text-xs leading-6 text-[var(--muted-foreground)]">{JSON.stringify(row, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
