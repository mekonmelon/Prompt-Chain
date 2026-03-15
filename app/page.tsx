import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type GenericRow = Record<string, unknown>

type TableResult = {
  rows: GenericRow[]
  error: string | null
  resolvedTable: string
}

type TableConfig = {
  key: string
  label: string
  sortColumn?: 'created_datetime_utc'
  missingTableIsEmpty?: boolean
}

const TABLES: Record<string, TableConfig> = {
  profiles: { key: 'profiles', label: 'profiles', sortColumn: 'created_datetime_utc' },
  images: { key: 'images', label: 'images', sortColumn: 'created_datetime_utc' },
  humorFlavors: { key: 'humor_flavors', label: 'humor_flavors' },
  humorFlavorSteps: { key: 'humor_flavor_steps', label: 'humor_flavor_steps' },
  humorFlavorMix: { key: 'humor_flavor_mix', label: 'humor_flavor_mix', sortColumn: 'created_datetime_utc' },
  terms: { key: 'terms', label: 'terms', sortColumn: 'created_datetime_utc' },
  captions: { key: 'captions', label: 'captions', sortColumn: 'created_datetime_utc' },
  captionRequests: { key: 'caption_requests', label: 'caption_requests', sortColumn: 'created_datetime_utc' },
  captionExamples: { key: 'caption_examples', label: 'caption_examples', sortColumn: 'created_datetime_utc' },
  llmModels: { key: 'llm_models', label: 'llm_models', sortColumn: 'created_datetime_utc' },
  llmProviders: { key: 'llm_providers', label: 'llm_providers', sortColumn: 'created_datetime_utc' },
  llmPromptChains: { key: 'llm_prompt_chains', label: 'llm_prompt_chains', sortColumn: 'created_datetime_utc' },
  llmResponses: { key: 'llm_model_responses', label: 'llm_model_responses' },
  allowedSignupDomains: { key: 'allowed_signup_domains', label: 'allowed_signup_domains', sortColumn: 'created_datetime_utc' },
  whitelistedEmailAddresses: { key: 'whitelist_email_addresses', label: 'whitelist_email_addresses', sortColumn: 'created_datetime_utc' }
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function parsePayload(raw: FormDataEntryValue | null): GenericRow {
  const text = String(raw ?? '{}').trim()
  if (!text) return {}
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Payload must be a JSON object.')
  }
  return parsed as GenericRow
}

function isMissingTableError(message: string | null | undefined) {
  if (!message) return false
  return message.includes('schema cache') || message.includes('Could not find the table')
}

function getQueryValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value ?? '').trim().toLowerCase()
}

function matchesQuery(row: GenericRow, query: string) {
  if (!query) return true
  return Object.values(row).some((value) => asText(value).toLowerCase().includes(query))
}

function getRowId(row: GenericRow) {
  return asText(row.id)
}

function getCaptionId(row: GenericRow) {
  return asText(row.caption_id || row.captionId)
}

function getVoteValue(row: GenericRow) {
  const raw = row.vote_value ?? row.value ?? 0
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function getFlavorId(row: GenericRow) {
  return asText(row.id || row.flavor_id || row.humor_flavor_id)
}

function getStepFlavorId(row: GenericRow) {
  return asText(row.flavor_id || row.humor_flavor_id || row.humor_flavor)
}

function getCaptionText(row: GenericRow) {
  return asText(row.caption_text || row.content || row.text)
}

function discoverColumns(rows: GenericRow[], preferred: string[] = []) {
  const keys = new Set<string>()
  rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)))
  const preferredIncluded = preferred.filter((key) => keys.has(key))
  const others = [...keys].filter((key) => !preferredIncluded.includes(key)).sort((a, b) => a.localeCompare(b))
  return [...preferredIncluded, ...others]
}

async function createGenericRow(formData: FormData) {
  'use server'
  const supabase = createClient()
  const table = String(formData.get('table') ?? '')
  if (!table) return

  const payload = parsePayload(formData.get('payload'))

  if (table === TABLES.whitelistedEmailAddresses.key) {
    if ('email' in payload && !('email_address' in payload)) {
      payload.email_address = payload.email
      delete payload.email
    }
    payload.created_datetime_utc = payload.created_datetime_utc ?? new Date().toISOString()
    payload.modified_datetime_utc = payload.modified_datetime_utc ?? new Date().toISOString()
  }

  if (table === TABLES.images.key) {
    payload.created_datetime_utc = payload.created_datetime_utc ?? new Date().toISOString()
    payload.modified_datetime_utc = payload.modified_datetime_utc ?? new Date().toISOString()
  }

  await supabase.from(table).insert(payload)
  revalidatePath('/')
}

async function updateGenericRow(formData: FormData) {
  'use server'
  const supabase = createClient()
  const table = String(formData.get('table') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!table || !id) return

  const payload = parsePayload(formData.get('payload'))

  if (table === TABLES.images.key || table === TABLES.whitelistedEmailAddresses.key) {
    payload.modified_datetime_utc = new Date().toISOString()
  }

  if (table === TABLES.whitelistedEmailAddresses.key && 'email' in payload && !('email_address' in payload)) {
    payload.email_address = payload.email
    delete payload.email
  }

  await supabase.from(table).update(payload).eq('id', id)
  revalidatePath('/')
}

async function deleteGenericRow(formData: FormData) {
  'use server'
  const supabase = createClient()
  const table = String(formData.get('table') ?? '')
  const id = String(formData.get('id') ?? '')
  if (!table || !id) return

  await supabase.from(table).delete().eq('id', id)
  revalidatePath('/')
}

async function createImageRow(formData: FormData) {
  'use server'
  const supabase = createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const url = String(formData.get('url') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const profileId = String(formData.get('profile_id') ?? '').trim() || user?.id
  if (!url) return

  const payload: GenericRow = {
    url,
    image_description: description,
    created_datetime_utc: new Date().toISOString(),
    modified_datetime_utc: new Date().toISOString()
  }

  if (profileId) payload.profile_id = profileId

  await supabase.from(TABLES.images.key).insert(payload)
  revalidatePath('/')
}

async function signOut() {
  'use server'
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function CompactTable({ rows, preferred, limit = 10 }: { rows: GenericRow[]; preferred?: string[]; limit?: number }) {
  const columns = discoverColumns(rows, preferred).slice(0, 6)

  if (!rows.length) {
    return <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">No rows found.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((row, index) => (
            <tr key={getRowId(row) || index} className="border-t border-slate-100 align-top">
              {columns.map((column) => (
                <td key={`${index}-${column}`} className="max-w-[240px] px-3 py-2 text-slate-700">
                  <div className="truncate" title={asText(row[column])}>
                    {asText(row[column])}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CrudCard({ table, title, description, rows, preferred }: { table: string; title: string; description: string; rows: GenericRow[]; preferred?: string[] }) {
  return (
    <SectionCard subtitle={description} title={title}>
      <details className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Create row (JSON payload)</summary>
        <form action={createGenericRow} className="mt-3">
          <input name="table" type="hidden" value={table} />
          <textarea className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs" defaultValue="{}" name="payload" rows={4} />
          <button className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700" type="submit">
            Create Row
          </button>
        </form>
      </details>

      <CompactTable preferred={preferred} rows={rows} />

      <div className="mt-3 space-y-2">
        {rows.slice(0, 6).map((row) => {
          const id = getRowId(row)
          if (!id) return null
          return (
            <details key={id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Edit row {id}</summary>
              <form action={updateGenericRow} className="mt-3 space-y-2">
                <input name="table" type="hidden" value={table} />
                <input name="id" type="hidden" value={id} />
                <textarea className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs" defaultValue={JSON.stringify(row, null, 2)} name="payload" rows={6} />
                <div className="flex gap-2">
                  <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700" type="submit">
                    Update
                  </button>
                </div>
              </form>
              <form action={deleteGenericRow} className="mt-2">
                <input name="table" type="hidden" value={table} />
                <input name="id" type="hidden" value={id} />
                <button className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700" type="submit">
                  Delete
                </button>
              </form>
            </details>
          )
        })}
      </div>
    </SectionCard>
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

  const fetchTable = async (config: TableConfig): Promise<TableResult> => {
    try {
      let query = supabase.from(config.key).select('*').limit(50)
      if (config.sortColumn) {
        query = query.order(config.sortColumn, { ascending: false })
      }

      const { data, error } = await query

      if (error) {
        if (config.missingTableIsEmpty && isMissingTableError(error.message)) {
          return { rows: [], error: null, resolvedTable: config.key }
        }
        return { rows: [], error: error.message, resolvedTable: config.key }
      }

      return { rows: (data ?? []) as GenericRow[], error: null, resolvedTable: config.key }
    } catch (error) {
      return {
        rows: [],
        error: error instanceof Error ? error.message : `Unknown fetch error for ${config.key}`,
        resolvedTable: config.key
      }
    }
  }

  const settled = await Promise.allSettled([
    fetchTable(TABLES.profiles),
    fetchTable(TABLES.images),
    fetchTable(TABLES.humorFlavors),
    fetchTable(TABLES.humorFlavorSteps),
    fetchTable(TABLES.humorFlavorMix),
    fetchTable(TABLES.terms),
    fetchTable(TABLES.captions),
    fetchTable(TABLES.captionRequests),
    fetchTable(TABLES.captionExamples),
    fetchTable(TABLES.llmModels),
    fetchTable(TABLES.llmProviders),
    fetchTable(TABLES.llmPromptChains),
    fetchTable(TABLES.llmResponses),
    fetchTable(TABLES.allowedSignupDomains),
    fetchTable(TABLES.whitelistedEmailAddresses)
  ])

  const toResult = (item: PromiseSettledResult<TableResult>, key: string): TableResult =>
    item.status === 'fulfilled'
      ? item.value
      : {
          rows: [],
          error: item.reason instanceof Error ? item.reason.message : `Failed to fetch ${key}`,
          resolvedTable: key
        }

  const [
    profiles,
    images,
    humorFlavors,
    humorFlavorSteps,
    humorFlavorMix,
    terms,
    captions,
    captionRequests,
    captionExamples,
    llmModels,
    llmProviders,
    llmPromptChains,
    llmResponses,
    allowedSignupDomains,
    whitelistedEmailAddresses
  ] = [
    toResult(settled[0], TABLES.profiles.key),
    toResult(settled[1], TABLES.images.key),
    toResult(settled[2], TABLES.humorFlavors.key),
    toResult(settled[3], TABLES.humorFlavorSteps.key),
    toResult(settled[4], TABLES.humorFlavorMix.key),
    toResult(settled[5], TABLES.terms.key),
    toResult(settled[6], TABLES.captions.key),
    toResult(settled[7], TABLES.captionRequests.key),
    toResult(settled[8], TABLES.captionExamples.key),
    toResult(settled[9], TABLES.llmModels.key),
    toResult(settled[10], TABLES.llmProviders.key),
    toResult(settled[11], TABLES.llmPromptChains.key),
    toResult(settled[12], TABLES.llmResponses.key),
    toResult(settled[13], TABLES.allowedSignupDomains.key),
    toResult(settled[14], TABLES.whitelistedEmailAddresses.key)
  ]

  const allErrors = [
    [profiles.resolvedTable, profiles.error],
    [images.resolvedTable, images.error],
    [humorFlavors.resolvedTable, humorFlavors.error],
    [humorFlavorSteps.resolvedTable, humorFlavorSteps.error],
    [humorFlavorMix.resolvedTable, humorFlavorMix.error],
    [terms.resolvedTable, terms.error],
    [captions.resolvedTable, captions.error],
    [captionRequests.resolvedTable, captionRequests.error],
    [captionExamples.resolvedTable, captionExamples.error],
    [llmModels.resolvedTable, llmModels.error],
    [llmProviders.resolvedTable, llmProviders.error],
    [llmPromptChains.resolvedTable, llmPromptChains.error],
    [llmResponses.resolvedTable, llmResponses.error],
    [allowedSignupDomains.resolvedTable, allowedSignupDomains.error],
    [whitelistedEmailAddresses.resolvedTable, whitelistedEmailAddresses.error]
  ].filter(([, error]) => Boolean(error))

  const [{ count: totalUsersCount }, { count: totalImagesCount }, { count: totalCaptionsCount }] = await Promise.all([
    supabase.from(TABLES.profiles.key).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.images.key).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.captions.key).select('*', { count: 'exact', head: true })
  ])

  const totalUsers = totalUsersCount ?? 0
  const totalImages = totalImagesCount ?? 0
  const totalCaptions = totalCaptionsCount ?? 0
  const avgCaptionsPerImage = totalImages ? (totalCaptions / totalImages).toFixed(2) : '0.00'

  const { data: topCaptionCandidates } = await supabase
    .from(TABLES.captions.key)
    .select('id, content, image_id')
    .order('created_datetime_utc', { ascending: false })
    .limit(200)

  const topCaptionRows = (topCaptionCandidates ?? []) as GenericRow[]
  const candidateCaptionIds = topCaptionRows.map((row) => getRowId(row)).filter(Boolean)

  const { data: voteRows } = candidateCaptionIds.length
    ? await supabase
        .from('caption_votes')
        .select('caption_id, vote_value')
        .in('caption_id', candidateCaptionIds)
    : { data: [] as GenericRow[] }

  const votesByCaption = ((voteRows ?? []) as GenericRow[]).reduce<Record<string, number>>((acc, vote) => {
    const captionId = getCaptionId(vote)
    if (!captionId) return acc
    acc[captionId] = (acc[captionId] ?? 0) + getVoteValue(vote)
    return acc
  }, {})

  const topCaptions = topCaptionRows
    .map((caption) => {
      const id = getRowId(caption)
      return {
        id,
        text: getCaptionText(caption),
        votes: id ? votesByCaption[id] ?? 0 : 0
      }
    })
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5)

  const llmSearch = getQueryValue(searchParams?.llmSearch)
  const auditSearch = getQueryValue(searchParams?.auditSearch)

  const filteredPromptChains = llmPromptChains.rows.filter((row) => matchesQuery(row, llmSearch))
  const filteredResponses = llmResponses.rows.filter((row) => matchesQuery(row, auditSearch))

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-[95%] max-w-7xl items-center justify-between py-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">The Humor Project Admin</h1>
            <p className="text-sm text-slate-600">Welcome back, {user?.email ?? 'Admin'}.</p>
          </div>
          <form action={signOut}>
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700" type="submit">
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto grid w-[95%] max-w-7xl gap-6 py-8">
        {allErrors.length > 0 ? (
          <section className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800">
            <h2 className="text-lg font-semibold">Table fetch errors</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {allErrors.map(([table, error]) => (
                <li key={String(table)}>
                  {table}: {error}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Total Users</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{totalUsers}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Total Images</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{totalImages}</p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Avg Captions / Image</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{avgCaptionsPerImage}</p>
          </div>
        </section>

        <SectionCard title="Overview" subtitle="Top-level snapshot, users, and image management.">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Top 5 Captions by Votes</h3>
              <ul className="space-y-2">
                {topCaptions.length ? (
                  topCaptions.map((caption) => (
                    <li key={caption.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold">Caption #{caption.id || 'unknown'}</span>
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{caption.votes} votes</span>
                      </div>
                      <p>{caption.text || 'No caption text field found.'}</p>
                    </li>
                  ))
                ) : (
                  <li className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No vote data available.</li>
                )}
              </ul>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Users (Read)</h3>
                <CompactTable preferred={['id', 'email', 'is_superadmin', 'created_datetime_utc']} rows={profiles.rows} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Captions (Read)</h3>
                <CompactTable preferred={['id', 'caption_text', 'content', 'image_id', 'created_datetime_utc']} rows={captions.rows} />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Images" subtitle="Create/read/update/delete image rows and use URL-based upload form.">
          <form action={createImageRow} className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            <input className="rounded-md border border-slate-300 px-3 py-2" name="url" placeholder="https://image-url" required />
            <input className="rounded-md border border-slate-300 px-3 py-2" name="description" placeholder="image description (optional)" />
            <input className="rounded-md border border-slate-300 px-3 py-2" name="profile_id" placeholder="profile_id (optional)" />
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 md:col-span-3" type="submit">
              Upload New Image Row
            </button>
          </form>
          <p className="mb-4 text-xs text-slate-500">TODO: If/when a Supabase Storage upload flow is defined in schema/project docs, replace URL-only create with direct file upload.</p>
          <CompactTable preferred={['id', 'url', 'image_description', 'profile_id', 'created_datetime_utc']} rows={images.rows} />
          <div className="mt-3 space-y-2">
            {images.rows.slice(0, 6).map((row) => {
              const id = getRowId(row)
              if (!id) return null
              return (
                <details key={id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Edit image {id}</summary>
                  <form action={updateGenericRow} className="mt-2 space-y-2">
                    <input name="table" type="hidden" value={images.resolvedTable} />
                    <input name="id" type="hidden" value={id} />
                    <textarea className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs" defaultValue={JSON.stringify(row, null, 2)} name="payload" rows={6} />
                    <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700" type="submit">
                      Update Image
                    </button>
                  </form>
                  <form action={deleteGenericRow} className="mt-2">
                    <input name="table" type="hidden" value={images.resolvedTable} />
                    <input name="id" type="hidden" value={id} />
                    <button className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700" type="submit">
                      Delete Image
                    </button>
                  </form>
                </details>
              )
            })}
          </div>
        </SectionCard>

        <section className="grid gap-4">
          <h2 className="text-xl font-bold text-slate-900">1. Humor Pipeline</h2>
          <SectionCard title="Humor Flavors + Steps" subtitle="Read flavors and expand a flavor to inspect related humor_flavor_steps.">
            <div className="space-y-2">
              {humorFlavors.rows.length ? (
                humorFlavors.rows.map((flavor, index) => {
                  const flavorId = getFlavorId(flavor)
                  const relatedSteps = humorFlavorSteps.rows.filter((step) => getStepFlavorId(step) === flavorId)
                  return (
                    <details key={flavorId || index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-800">{asText(flavor.name || flavor.title || `Flavor ${index + 1}`)}</summary>
                      <div className="mt-2 text-xs text-slate-500">Flavor ID: {flavorId || 'unknown'}</div>
                      <div className="mt-3">
                        <CompactTable preferred={['id', 'flavor_id', 'step_order', 'step_prompt']} rows={relatedSteps} />
                      </div>
                    </details>
                  )
                })
              ) : (
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">No flavor rows found.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Humor Mix (Read / Update)" subtitle="Edit existing mix rows in place.">
            <CompactTable preferred={['id', 'flavor_id', 'caption_count', 'created_datetime_utc']} rows={humorFlavorMix.rows} />
            <div className="mt-3 space-y-2">
              {humorFlavorMix.rows.slice(0, 6).map((row) => {
                const id = getRowId(row)
                if (!id) return null
                return (
                  <details key={id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Edit humor mix {id}</summary>
                    <form action={updateGenericRow} className="mt-2">
                      <input name="table" type="hidden" value={humorFlavorMix.resolvedTable} />
                      <input name="id" type="hidden" value={id} />
                      <textarea className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs" defaultValue={JSON.stringify(row, null, 2)} name="payload" rows={6} />
                      <button className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700" type="submit">
                        Update Mix
                      </button>
                    </form>
                  </details>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard title="Caption Requests (Read)" subtitle="Recent caption generation requests.">
            <CompactTable preferred={['id', 'image_id', 'status', 'created_datetime_utc']} rows={captionRequests.rows} />
          </SectionCard>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-bold text-slate-900">2. LLM</h2>
          <CrudCard description="Create/read/update/delete model rows." rows={llmModels.rows} table={llmModels.resolvedTable} title="LLM Models (CRUD)" />
          <CrudCard description="Create/read/update/delete provider rows." rows={llmProviders.rows} table={llmProviders.resolvedTable} title="LLM Providers (CRUD)" />

          <SectionCard title="LLM Prompt Chains (Read + Search)" subtitle="Read-only prompt chain table with lightweight server-side filtering.">
            <form className="mb-3">
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={llmSearch} name="llmSearch" placeholder="Search prompt chains" />
            </form>
            <CompactTable preferred={['id', 'name', 'created_datetime_utc']} rows={filteredPromptChains} />
          </SectionCard>

          <SectionCard title="LLM Model Responses (Read + Search)" subtitle="Read-only model responses table with search.">
            <form className="mb-3">
              <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={auditSearch} name="auditSearch" placeholder="Search model responses" />
            </form>
            <CompactTable preferred={['id', 'caption_request_id', 'model_id', 'created_datetime_utc']} rows={filteredResponses} />
          </SectionCard>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-bold text-slate-900">3. Content/Admin</h2>
          <CrudCard description="Create/read/update/delete terms." rows={terms.rows} table={terms.resolvedTable} title="Terms (CRUD)" />
          <CrudCard description="Create/read/update/delete caption examples." rows={captionExamples.rows} table={captionExamples.resolvedTable} title="Caption Examples (CRUD)" />
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-bold text-slate-900">4. Access</h2>
          <CrudCard description="Create/read/update/delete allowed signup domains." rows={allowedSignupDomains.rows} table={allowedSignupDomains.resolvedTable} title="Allowed Signup Domains (CRUD)" />
          <CrudCard
            description="Create/read/update/delete whitelist email addresses. Uses email_address field in whitelist_email_addresses."
            preferred={['id', 'email_address', 'created_datetime_utc', 'modified_datetime_utc']}
            rows={whitelistedEmailAddresses.rows}
            table={whitelistedEmailAddresses.resolvedTable}
            title="Whitelist Email Addresses (CRUD)"
          />
        </section>
      </main>
    </div>
  )
}
