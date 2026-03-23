import { revalidatePath } from 'next/cache'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { TestRunner } from '@/components/studio/test-runner'
import { createClient, requireCurrentProfileId } from '@/lib/supabase/server'
import { fetchCurrentProfile } from '@/lib/supabase/profile'

type GenericRow = Record<string, unknown>

type TableConfig = {
  key: string
  sortColumn?: 'created_datetime_utc' | 'modified_datetime_utc'
  limit?: number
}

type ViewId = 'overview' | 'flavors' | 'steps' | 'test-runner' | 'results' | 'audit'

type StudioNavItem = {
  id: ViewId
  label: string
  description: string
}

const TABLES = {
  flavors: { key: 'humor_flavors', sortColumn: 'modified_datetime_utc', limit: 100 },
  steps: { key: 'humor_flavor_steps', sortColumn: 'modified_datetime_utc', limit: 300 },
  captions: { key: 'captions', sortColumn: 'created_datetime_utc', limit: 150 },
  images: { key: 'images', sortColumn: 'created_datetime_utc', limit: 60 },
  promptChains: { key: 'llm_prompt_chains', sortColumn: 'created_datetime_utc', limit: 60 },
  responses: { key: 'llm_model_responses', sortColumn: 'created_datetime_utc', limit: 80 }
} satisfies Record<string, TableConfig>

const NAV_ITEMS: StudioNavItem[] = [
  { id: 'overview', label: 'Overview', description: 'Flavor stats, quick actions, and studio notes.' },
  { id: 'flavors', label: 'Flavors', description: 'Create, duplicate, update, and remove humor flavors.' },
  { id: 'steps', label: 'Steps', description: 'Edit ordered chain steps for the selected flavor.' },
  { id: 'test-runner', label: 'Test Runner', description: 'Run a flavor against an image through the Humor Project API.' },
  { id: 'results', label: 'Results / Captions', description: 'Browse captions associated with the selected flavor.' },
  { id: 'audit', label: 'Audit Trail', description: 'Inspect prompt-chain and model-response debugging traces.' }
]

function asText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getView(value: string): ViewId {
  return NAV_ITEMS.some((item) => item.id === value) ? (value as ViewId) : 'overview'
}

function getRowId(row: GenericRow) {
  return asText(row.id)
}

function getFlavorName(row: GenericRow) {
  return asText(row.name || row.title || row.flavor_name)
}

function getFlavorDescription(row: GenericRow) {
  return asText(row.description || row.notes || row.summary)
}

function getFlavorNameKey(rows: GenericRow[]) {
  const sample = rows[0] ?? {}
  if ('name' in sample) return 'name'
  if ('title' in sample) return 'title'
  if ('flavor_name' in sample) return 'flavor_name'
  return 'name'
}

function getFlavorDescriptionKey(rows: GenericRow[]) {
  const sample = rows[0] ?? {}
  if ('description' in sample) return 'description'
  if ('notes' in sample) return 'notes'
  if ('summary' in sample) return 'summary'
  return 'description'
}

function getStepFlavorKey(rows: GenericRow[]) {
  const sample = rows[0] ?? {}
  if ('humor_flavor_id' in sample) return 'humor_flavor_id'
  if ('flavor_id' in sample) return 'flavor_id'
  return 'flavor_id'
}

function getStepOrderKey(rows: GenericRow[]) {
  const sample = rows[0] ?? {}
  if ('step_order' in sample) return 'step_order'
  if ('order_index' in sample) return 'order_index'
  if ('order' in sample) return 'order'
  if ('sequence' in sample) return 'sequence'
  return 'step_order'
}

function getStepTitleKey(rows: GenericRow[]) {
  const sample = rows[0] ?? {}
  if ('step_title' in sample) return 'step_title'
  if ('title' in sample) return 'title'
  if ('step_type' in sample) return 'step_type'
  return 'step_title'
}

function getStepContentKey(rows: GenericRow[]) {
  const sample = rows[0] ?? {}
  if ('step_content' in sample) return 'step_content'
  if ('prompt' in sample) return 'prompt'
  if ('content' in sample) return 'content'
  if ('user_prompt' in sample) return 'user_prompt'
  return 'step_content'
}

function getStepOrder(row: GenericRow) {
  return asNumber(row.step_order ?? row.order_index ?? row.order ?? row.sequence, 0)
}

function getStepFlavorId(row: GenericRow) {
  return asText(row.humor_flavor_id || row.flavor_id)
}

function getStepTitle(row: GenericRow) {
  return asText(row.step_title || row.title || row.step_type || row.input_type || `Step ${getStepOrder(row)}`)
}

function getStepContent(row: GenericRow) {
  return asText(row.step_content || row.prompt || row.user_prompt || row.system_prompt || row.content)
}

function getImagePreview(row: GenericRow) {
  return asText(row.url || row.image_url || row.image_src || row.public_url || row.path)
}

function getCaptionText(row: GenericRow) {
  return asText(row.content || row.caption_text || row.text)
}

function getCaptionFlavorId(row: GenericRow) {
  return asText(row.humor_flavor_id || row.flavor_id)
}

async function signOut() {
  'use server'
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

async function createFlavor(formData: FormData) {
  'use server'
  const supabase = createClient()
  const currentProfileId = await requireCurrentProfileId(supabase)
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return

  const nameKey = String(formData.get('name_key') ?? 'name')
  const descriptionKey = String(formData.get('description_key') ?? 'description')
  const payload: GenericRow = {
    [nameKey]: name,
    created_by_user_id: currentProfileId,
    modified_by_user_id: currentProfileId
  }
  const description = String(formData.get('description') ?? '').trim()
  if (description) payload[descriptionKey] = description

  await supabase.from(TABLES.flavors.key).insert(payload)
  revalidatePath('/')
}

async function updateFlavor(formData: FormData) {
  'use server'
  const supabase = createClient()
  const currentProfileId = await requireCurrentProfileId(supabase)
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return

  const payload: GenericRow = {
    modified_by_user_id: currentProfileId
  }
  const nameKey = String(formData.get('name_key') ?? 'name')
  const descriptionKey = String(formData.get('description_key') ?? 'description')
  payload[nameKey] = String(formData.get('name') ?? '').trim()
  payload[descriptionKey] = String(formData.get('description') ?? '').trim()

  await supabase.from(TABLES.flavors.key).update(payload).eq('id', id)
  revalidatePath('/')
}

async function deleteFlavor(formData: FormData) {
  'use server'
  const supabase = createClient()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return
  await supabase.from(TABLES.flavors.key).delete().eq('id', id)
  revalidatePath('/')
}

async function duplicateFlavor(formData: FormData) {
  'use server'
  const supabase = createClient()
  const currentProfileId = await requireCurrentProfileId(supabase)
  const sourcePayload = String(formData.get('source_payload') ?? '{}')
  let source: GenericRow = {}
  try {
    const parsed = JSON.parse(sourcePayload)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) source = parsed
  } catch {
    source = {}
  }

  const nameKey = String(formData.get('name_key') ?? 'name')
  const duplicate: GenericRow = {
    ...source,
    created_by_user_id: currentProfileId,
    modified_by_user_id: currentProfileId
  }
  delete duplicate.id
  delete duplicate.created_datetime_utc
  delete duplicate.modified_datetime_utc
  duplicate[nameKey] = `${asText(source[nameKey]) || 'Flavor'} Copy`

  await supabase.from(TABLES.flavors.key).insert(duplicate)
  revalidatePath('/')
}

async function createStep(formData: FormData) {
  'use server'
  const supabase = createClient()
  const currentProfileId = await requireCurrentProfileId(supabase)
  const flavorId = String(formData.get('flavor_id') ?? '').trim()
  if (!flavorId) return

  const flavorKey = String(formData.get('flavor_key') ?? 'flavor_id')
  const orderKey = String(formData.get('order_key') ?? 'step_order')
  const titleKey = String(formData.get('title_key') ?? 'step_title')
  const contentKey = String(formData.get('content_key') ?? 'step_content')
  const payload: GenericRow = {
    [flavorKey]: flavorId,
    [orderKey]: asNumber(formData.get('step_order')),
    [titleKey]: String(formData.get('step_title') ?? '').trim(),
    [contentKey]: String(formData.get('step_content') ?? '').trim(),
    created_by_user_id: currentProfileId,
    modified_by_user_id: currentProfileId
  }

  const inputType = String(formData.get('input_type') ?? '').trim()
  const outputType = String(formData.get('output_type') ?? '').trim()
  const temperature = String(formData.get('temperature') ?? '').trim()
  const systemPrompt = String(formData.get('system_prompt') ?? '').trim()
  const userPrompt = String(formData.get('user_prompt') ?? '').trim()
  if (inputType) payload.input_type = inputType
  if (outputType) payload.output_type = outputType
  if (temperature) payload.temperature = asNumber(temperature)
  if (systemPrompt) payload.system_prompt = systemPrompt
  if (userPrompt) payload.user_prompt = userPrompt
  if (formData.get('is_active')) payload.is_active = true

  await supabase.from(TABLES.steps.key).insert(payload)
  revalidatePath('/')
}

async function updateStep(formData: FormData) {
  'use server'
  const supabase = createClient()
  const currentProfileId = await requireCurrentProfileId(supabase)
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return

  const orderKey = String(formData.get('order_key') ?? 'step_order')
  const titleKey = String(formData.get('title_key') ?? 'step_title')
  const contentKey = String(formData.get('content_key') ?? 'step_content')
  const payload: GenericRow = {
    [orderKey]: asNumber(formData.get('step_order')),
    [titleKey]: String(formData.get('step_title') ?? '').trim(),
    [contentKey]: String(formData.get('step_content') ?? '').trim(),
    modified_by_user_id: currentProfileId,
    input_type: String(formData.get('input_type') ?? '').trim() || null,
    output_type: String(formData.get('output_type') ?? '').trim() || null,
    temperature: String(formData.get('temperature') ?? '').trim() ? asNumber(formData.get('temperature')) : null,
    system_prompt: String(formData.get('system_prompt') ?? '').trim() || null,
    user_prompt: String(formData.get('user_prompt') ?? '').trim() || null,
    is_active: Boolean(formData.get('is_active'))
  }

  await supabase.from(TABLES.steps.key).update(payload).eq('id', id)
  revalidatePath('/')
}

async function deleteStep(formData: FormData) {
  'use server'
  const supabase = createClient()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) return
  await supabase.from(TABLES.steps.key).delete().eq('id', id)
  revalidatePath('/')
}

async function moveStep(formData: FormData) {
  'use server'
  const supabase = createClient()
  const currentProfileId = await requireCurrentProfileId(supabase)
  const sourceId = String(formData.get('source_id') ?? '').trim()
  const targetId = String(formData.get('target_id') ?? '').trim()
  const orderKey = String(formData.get('order_key') ?? 'step_order')
  const sourceOrder = asNumber(formData.get('source_order'))
  const targetOrder = asNumber(formData.get('target_order'))
  if (!sourceId || !targetId) return

  await supabase.from(TABLES.steps.key).update({ [orderKey]: targetOrder, modified_by_user_id: currentProfileId }).eq('id', sourceId)
  await supabase.from(TABLES.steps.key).update({ [orderKey]: sourceOrder, modified_by_user_id: currentProfileId }).eq('id', targetId)
  revalidatePath('/')
}

function StudioCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-500">Prompt Chain Studio</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

export default async function Home({
  searchParams
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const supabase = createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const currentProfile = await fetchCurrentProfile(supabase, 'id, email, first_name, is_superadmin, is_matrix_admin')
  const isAuthorized = Boolean(currentProfile?.is_superadmin || currentProfile?.is_matrix_admin)
  if (!isAuthorized) redirect('/unauthorized')

  const fetchTable = async (config: TableConfig) => {
    let query = supabase.from(config.key).select('*').limit(config.limit ?? 100)
    if (config.sortColumn) query = query.order(config.sortColumn, { ascending: false })
    const { data, error } = await query
    return {
      rows: (data ?? []) as GenericRow[],
      error: error?.message ?? null
    }
  }

  const [flavorsResult, stepsResult, captionsResult, imagesResult, promptChainsResult, responsesResult] = await Promise.all([
    fetchTable(TABLES.flavors),
    fetchTable(TABLES.steps),
    fetchTable(TABLES.captions),
    fetchTable(TABLES.images),
    fetchTable(TABLES.promptChains),
    fetchTable(TABLES.responses)
  ])

  const flavors = flavorsResult.rows
  const steps = stepsResult.rows
  const captions = captionsResult.rows
  const images = imagesResult.rows
  const promptChains = promptChainsResult.rows
  const responses = responsesResult.rows

  const view = getView(asText(Array.isArray(searchParams?.view) ? searchParams?.view[0] : searchParams?.view))
  const search = asText(Array.isArray(searchParams?.q) ? searchParams?.q[0] : searchParams?.q).toLowerCase()

  const selectedFlavorId = asText(Array.isArray(searchParams?.flavor) ? searchParams?.flavor[0] : searchParams?.flavor) || getRowId(flavors[0] ?? {})
  const selectedFlavor = flavors.find((row) => getRowId(row) === selectedFlavorId) ?? flavors[0] ?? null
  const selectedFlavorSteps = steps.filter((row) => getStepFlavorId(row) === getRowId(selectedFlavor ?? {})).sort((a, b) => getStepOrder(a) - getStepOrder(b))
  const filteredFlavors = flavors.filter((row) => {
    if (!search) return true
    return getFlavorName(row).toLowerCase().includes(search) || getFlavorDescription(row).toLowerCase().includes(search)
  })
  const filteredCaptions = captions.filter((row) => {
    if (!search && selectedFlavor) {
      const flavorId = getCaptionFlavorId(row)
      return !flavorId || flavorId === getRowId(selectedFlavor)
    }
    const matchesSearch = getCaptionText(row).toLowerCase().includes(search)
    const flavorId = getCaptionFlavorId(row)
    if (selectedFlavor && flavorId) return matchesSearch && flavorId === getRowId(selectedFlavor)
    return matchesSearch
  })
  const recentFlavor = [...flavors].sort((a, b) => asText(b.modified_datetime_utc).localeCompare(asText(a.modified_datetime_utc)))[0] ?? null
  const flavorNameKey = getFlavorNameKey(flavors)
  const flavorDescriptionKey = getFlavorDescriptionKey(flavors)
  const stepFlavorKey = getStepFlavorKey(steps)
  const stepOrderKey = getStepOrderKey(steps)
  const stepTitleKey = getStepTitleKey(steps)
  const stepContentKey = getStepContentKey(steps)
  const promptVariableHints = ['${image_description}', '${prior_step_output}', '${caption_style}', '${judge_feedback}']

  const [{ count: flavorCount }, { count: stepCount }] = await Promise.all([
    supabase.from(TABLES.flavors.key).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.steps.key).select('*', { count: 'exact', head: true })
  ])

  const errors = [flavorsResult, stepsResult, captionsResult, imagesResult, promptChainsResult, responsesResult]
    .map((result, index) => ({
      table: ['humor_flavors', 'humor_flavor_steps', 'captions', 'images', 'llm_prompt_chains', 'llm_model_responses'][index],
      error: result.error
    }))
    .filter((item) => item.error)

  const imageOptions = images.map((row) => ({
    id: getRowId(row),
    label: asText(row.image_description || row.description) || getImagePreview(row) || `Image ${getRowId(row)}`,
    previewUrl: getImagePreview(row)
  }))
  const authorizationLabel = Boolean(currentProfile?.is_superadmin) ? 'superadmin' : 'matrix admin'

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 xl:grid-cols-[300px_1fr]">
        <aside className="border-b border-slate-200 bg-slate-950 px-5 py-6 text-slate-100 dark:border-slate-800 xl:border-b-0 xl:border-r">
          <div className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200">Assignment 8</p>
            <h1 className="mt-3 text-2xl font-bold">Prompt Chain Studio</h1>
            <p className="mt-2 text-sm text-slate-300">
              Build, reorder, and test humor flavors as prompt chains for The Humor Project pipeline.
            </p>
          </div>

          <div className="mt-6 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = view === item.id
              return (
                <a
                  key={item.id}
                  href={`/?view=${item.id}${selectedFlavor ? `&flavor=${getRowId(selectedFlavor)}` : ''}`}
                  className={`block rounded-2xl px-4 py-3 transition ${
                    active ? 'bg-violet-500/20 text-white ring-1 ring-violet-400/50' : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <div className="font-semibold">{item.label}</div>
                  <div className="text-xs text-slate-400">{item.description}</div>
                </a>
              )
            })}
          </div>

          <div className="mt-6">
            <ThemeToggle />
          </div>
        </aside>

        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <header className="sticky top-0 z-10 mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white/80 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Prompt Chain Studio / {NAV_ITEMS.find((item) => item.id === view)?.label}</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Welcome, {asText(currentProfile?.first_name) || asText(currentProfile?.email) || user.email}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">Authorized via {authorizationLabel} access.</p>
            </div>
            <form action={signOut}>
              <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" type="submit">
                Sign Out
              </button>
            </form>
          </header>

          {errors.length ? (
            <div className="mb-6 rounded-3xl border border-rose-300 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              <p className="font-semibold">Some studio data could not be loaded.</p>
              <ul className="mt-3 list-disc space-y-1 pl-5">
                {errors.map((item) => (
                  <li key={item.table}>{item.table}: {item.error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {view === 'overview' ? (
            <div className="grid gap-6">
              <StudioCard title="Prompt-chain overview" subtitle="Humor flavors are editable prompt chains. Use this studio to shape step order, test variants, and inspect recent outputs.">
                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-6 text-white shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-100">What this tool does</p>
                    <p className="mt-3 text-lg font-semibold">Create flavors, tune ordered steps, test on image sets, and inspect generated captions without leaving the studio.</p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <a className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/20" href={`/?view=flavors${selectedFlavor ? `&flavor=${getRowId(selectedFlavor)}` : ''}#quick-create`}>
                        Create flavor
                      </a>
                      <a className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/20" href={`/?view=test-runner${selectedFlavor ? `&flavor=${getRowId(selectedFlavor)}` : ''}`}>
                        Test flavor
                      </a>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Flavors</p>
                      <p className="mt-2 text-3xl font-bold">{flavorCount ?? flavors.length}</p>
                    </article>
                    <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Steps</p>
                      <p className="mt-2 text-3xl font-bold">{stepCount ?? steps.length}</p>
                    </article>
                    <article className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Recently updated</p>
                      <p className="mt-2 text-lg font-semibold">{recentFlavor ? getFlavorName(recentFlavor) || 'Unnamed flavor' : 'None yet'}</p>
                    </article>
                  </div>
                </div>
              </StudioCard>

              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <StudioCard title="Recent flavor activity" subtitle="Quick read on what changed most recently.">
                  <div className="space-y-3">
                    {flavors.slice(0, 5).map((row) => (
                      <article key={getRowId(row)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{getFlavorName(row) || 'Unnamed flavor'}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{getFlavorDescription(row) || 'No description yet.'}</p>
                          </div>
                          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">
                            {steps.filter((step) => getStepFlavorId(step) === getRowId(row)).length} steps
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </StudioCard>

                <StudioCard title="Prompt-variable helper" subtitle="Common patterns to think about while chaining steps.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {promptVariableHints.map((hint) => (
                      <div key={hint} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                        {hint}
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                    Variables shown here are examples for prompt-chain thinking and debugging. Confirm the actual supported variables in your deployed REST API before relying on them in production.
                  </p>
                </StudioCard>
              </div>
            </div>
          ) : null}

          {view === 'flavors' ? (
            <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
              <StudioCard title="Flavor library" subtitle="Search existing flavors or start a new branch from scratch.">
                <form className="mb-4">
                  <input type="hidden" name="view" value="flavors" />
                  <input className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" defaultValue={search} name="q" placeholder="Search flavor names or notes" />
                </form>
                <div className="space-y-2">
                  {filteredFlavors.map((row) => {
                    const active = getRowId(row) === getRowId(selectedFlavor ?? {})
                    return (
                      <a
                        key={getRowId(row)}
                        href={`/?view=flavors&flavor=${getRowId(row)}`}
                        className={`block rounded-2xl px-4 py-3 transition ${
                          active ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900'
                        }`}
                      >
                        <div className="font-semibold">{getFlavorName(row) || 'Unnamed flavor'}</div>
                        <div className={`text-sm ${active ? 'text-violet-100' : 'text-slate-500 dark:text-slate-400'}`}>{getFlavorDescription(row) || 'No description yet.'}</div>
                      </a>
                    )
                  })}
                </div>

                <form action={createFlavor} className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950" id="quick-create">
                  <input type="hidden" name="name_key" value={flavorNameKey} />
                  <input type="hidden" name="description_key" value={flavorDescriptionKey} />
                  <input className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" name="name" placeholder="New flavor name" required />
                  <textarea className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" name="description" placeholder="What does this flavor aim to produce?" rows={4} />
                  <button className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500" type="submit">Create flavor</button>
                </form>
              </StudioCard>

              <StudioCard title={selectedFlavor ? getFlavorName(selectedFlavor) || 'Flavor detail' : 'Select a flavor'} subtitle="Edit flavor metadata, review step totals, and branch a copy when you want to experiment safely.">
                {selectedFlavor ? (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"><p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Steps</p><p className="mt-2 text-2xl font-bold">{selectedFlavorSteps.length}</p></article>
                      <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"><p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Updated</p><p className="mt-2 text-sm font-semibold">{asText(selectedFlavor.modified_datetime_utc) || '—'}</p></article>
                      <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"><p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Test action</p><a className="mt-2 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900" href={`/?view=test-runner&flavor=${getRowId(selectedFlavor)}`}>Open test runner</a></article>
                    </div>

                    <form action={updateFlavor} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                      <input type="hidden" name="id" value={getRowId(selectedFlavor)} />
                      <input type="hidden" name="name_key" value={flavorNameKey} />
                      <input type="hidden" name="description_key" value={flavorDescriptionKey} />
                      <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Flavor name
                        <input className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" defaultValue={getFlavorName(selectedFlavor)} name="name" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Description / notes
                        <textarea className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" defaultValue={getFlavorDescription(selectedFlavor)} name="description" rows={5} />
                      </label>
                      <button className="w-fit rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500" type="submit">Save flavor</button>
                    </form>
                    <div className="flex flex-wrap gap-3">
                      <form action={duplicateFlavor}>
                        <input type="hidden" name="name_key" value={flavorNameKey} />
                        <input type="hidden" name="source_payload" value={JSON.stringify(selectedFlavor)} />
                        <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200" type="submit">Duplicate</button>
                      </form>
                      <form action={deleteFlavor}>
                        <input type="hidden" name="id" value={getRowId(selectedFlavor)} />
                        <button className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:text-rose-300" type="submit">Delete</button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Choose a flavor from the left to inspect its metadata and actions.</p>
                )}
              </StudioCard>
            </div>
          ) : null}

          {view === 'steps' ? (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <StudioCard title={selectedFlavor ? `${getFlavorName(selectedFlavor) || 'Selected flavor'} steps` : 'Select a flavor'} subtitle="Maintain ordered prompt-chain behavior with create, edit, delete, and move controls.">
                {selectedFlavor ? (
                  <div className="space-y-4">
                    {selectedFlavorSteps.map((step, index) => {
                      const previous = selectedFlavorSteps[index - 1]
                      const next = selectedFlavorSteps[index + 1]
                      return (
                        <article key={getRowId(step)} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">{index + 1}</span>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{getStepTitle(step) || `Step ${index + 1}`}</h3>
                              </div>
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{getStepContent(step) || 'No prompt content recorded yet.'}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {asText(step.input_type) ? <span className="rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">in: {asText(step.input_type)}</span> : null}
                              {asText(step.output_type) ? <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">out: {asText(step.output_type)}</span> : null}
                              {asText(step.temperature) ? <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">temp: {asText(step.temperature)}</span> : null}
                            </div>
                          </div>

                          <form action={updateStep} className="grid gap-3 lg:grid-cols-2">
                            <input type="hidden" name="id" value={getRowId(step)} />
                            <input type="hidden" name="order_key" value={stepOrderKey} />
                            <input type="hidden" name="title_key" value={stepTitleKey} />
                            <input type="hidden" name="content_key" value={stepContentKey} />
                            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                              Step order
                              <input className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" defaultValue={getStepOrder(step)} name="step_order" />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                              Step title / type
                              <input className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" defaultValue={getStepTitle(step)} name="step_title" />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                              Input type
                              <input className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" defaultValue={asText(step.input_type)} name="input_type" />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                              Output type
                              <input className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" defaultValue={asText(step.output_type)} name="output_type" />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                              Temperature
                              <input className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" defaultValue={asText(step.temperature)} name="temperature" />
                            </label>
                            <label className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                              <input defaultChecked={step.is_active !== false} name="is_active" type="checkbox" /> Step enabled
                            </label>
                            <label className="lg:col-span-2 grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                              Step instructions / prompt
                              <textarea className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" defaultValue={getStepContent(step)} name="step_content" rows={4} />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                              System prompt
                              <textarea className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" defaultValue={asText(step.system_prompt)} name="system_prompt" rows={3} />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                              User prompt
                              <textarea className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" defaultValue={asText(step.user_prompt)} name="user_prompt" rows={3} />
                            </label>
                            <button className="lg:col-span-2 w-fit rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500" type="submit">Save step</button>
                          </form>
                          <div className="mt-3 flex flex-wrap gap-3">
                            {previous ? (
                              <form action={moveStep}>
                                <input type="hidden" name="source_id" value={getRowId(step)} />
                                <input type="hidden" name="target_id" value={getRowId(previous)} />
                                <input type="hidden" name="source_order" value={getStepOrder(step)} />
                                <input type="hidden" name="target_order" value={getStepOrder(previous)} />
                                <input type="hidden" name="order_key" value={stepOrderKey} />
                                <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200" type="submit">Move up</button>
                              </form>
                            ) : null}
                            {next ? (
                              <form action={moveStep}>
                                <input type="hidden" name="source_id" value={getRowId(step)} />
                                <input type="hidden" name="target_id" value={getRowId(next)} />
                                <input type="hidden" name="source_order" value={getStepOrder(step)} />
                                <input type="hidden" name="target_order" value={getStepOrder(next)} />
                                <input type="hidden" name="order_key" value={stepOrderKey} />
                                <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200" type="submit">Move down</button>
                              </form>
                            ) : null}
                            <form action={deleteStep}>
                              <input type="hidden" name="id" value={getRowId(step)} />
                              <button className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:text-rose-300" type="submit">Delete</button>
                            </form>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Select a flavor first to manage its ordered step chain.</p>
                )}
              </StudioCard>

              <StudioCard title="Add a new step" subtitle="Create the next ordered chain stage for the selected flavor." >
                {selectedFlavor ? (
                  <form action={createStep} className="space-y-4" id="quick-create">
                    <input type="hidden" name="flavor_id" value={getRowId(selectedFlavor)} />
                    <input type="hidden" name="flavor_key" value={stepFlavorKey} />
                    <input type="hidden" name="order_key" value={stepOrderKey} />
                    <input type="hidden" name="title_key" value={stepTitleKey} />
                    <input type="hidden" name="content_key" value={stepContentKey} />
                    <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Step order
                      <input className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" defaultValue={selectedFlavorSteps.length + 1} name="step_order" />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Step title
                      <input className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" name="step_title" placeholder="e.g. Scene extraction" />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Step content / prompt
                      <textarea className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" name="step_content" placeholder="Describe the instructions for this stage of the chain." rows={5} />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Input type
                        <input className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" name="input_type" placeholder="image_description" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Output type
                        <input className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" name="output_type" placeholder="funny_observations" />
                      </label>
                    </div>
                    <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      Temperature
                      <input className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 dark:text-white" name="temperature" placeholder="0.7" />
                    </label>
                    <button className="rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500" type="submit">Create step</button>
                  </form>
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Pick a flavor in the Flavors view first, then return here to build its chain.</p>
                )}
              </StudioCard>
            </div>
          ) : null}

          {view === 'test-runner' ? (
            <TestRunner
              flavors={flavors.map((row) => ({ id: getRowId(row), name: getFlavorName(row) || `Flavor ${getRowId(row)}` }))}
              images={imageOptions}
              selectedFlavorId={getRowId(selectedFlavor ?? {})}
            />
          ) : null}

          {view === 'results' ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <StudioCard title="Flavor results" subtitle="Browse recent captions tied to the selected flavor when that relationship exists in the schema.">
                <div className="space-y-3">
                  {filteredCaptions.length ? (
                    filteredCaptions.map((caption) => {
                      const image = images.find((row) => getRowId(row) === asText(caption.image_id))
                      const preview = image ? getImagePreview(image) : ''
                      return (
                        <article key={getRowId(caption)} className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[120px_1fr] dark:border-slate-800 dark:bg-slate-950">
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
                            {preview ? <Image alt="Caption result image" className="h-28 w-full object-cover" height={160} src={preview} unoptimized width={160} /> : <div className="flex h-28 items-center justify-center text-xs text-slate-500 dark:text-slate-400">No image preview</div>}
                          </div>
                          <div>
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-200">Flavor {getCaptionFlavorId(caption) || 'n/a'}</span>
                              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{asText(caption.created_datetime_utc) || 'No timestamp'}</span>
                            </div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{getCaptionText(caption) || 'No caption text found.'}</p>
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Image ID: {asText(caption.image_id) || '—'}</p>
                          </div>
                        </article>
                      )
                    })
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No captions matched the selected flavor or current search.</p>
                  )}
                </div>
              </StudioCard>

              <StudioCard title="Result notes" subtitle="How to interpret what you see here.">
                <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <li>• If caption rows include `flavor_id` or `humor_flavor_id`, this view filters to the selected flavor.</li>
                  <li>• If the schema does not store a direct flavor reference on captions, you will still see recent results while using the test runner for immediate output inspection.</li>
                  <li>• Use the Audit Trail to inspect prompt and model-response evidence for debugging.</li>
                </ul>
              </StudioCard>
            </div>
          ) : null}

          {view === 'audit' ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <StudioCard title="Prompt chains" subtitle="Read-only debugging surface for stored prompt-chain records.">
                <div className="space-y-3">
                  {promptChains.map((row) => (
                    <article key={getRowId(row)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{asText(row.name || row.chain_name) || `Chain ${getRowId(row)}`}</p>
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{asText(row.model_id || row.provider_id) || 'No model ref'}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{asText(row.prompt || row.system_prompt || row.content) || 'No prompt text found.'}</p>
                    </article>
                  ))}
                </div>
              </StudioCard>

              <StudioCard title="Model responses" subtitle="Most recent model outputs for inspection and debugging.">
                <div className="space-y-3">
                  {responses.map((row) => (
                    <details key={getRowId(row)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                      <summary className="cursor-pointer list-none font-semibold text-slate-900 dark:text-white">
                        {asText(row.created_datetime_utc) || 'No timestamp'} · {asText(row.model_id || row.provider_id) || 'Unknown model'}
                      </summary>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{asText(row.response || row.output || row.content) || 'No response text found.'}</pre>
                    </details>
                  ))}
                </div>
              </StudioCard>
            </div>
          ) : null}

          <a
            className={`fixed bottom-6 right-6 rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-violet-500 ${
              view === 'flavors' || view === 'steps' ? '' : 'hidden'
            }`}
            href="#quick-create"
          >
            + Quick Create
          </a>
        </div>
      </div>
    </div>
  )
}
