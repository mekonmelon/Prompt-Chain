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

function discoverColumns(rows: GenericRow[], preferred: string[] = []) {
  const keys = new Set<string>()
  rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)))
  const preferredIncluded = preferred.filter((key) => keys.has(key))
  const others = [...keys].filter((key) => !preferredIncluded.includes(key)).sort((a, b) => a.localeCompare(b))
  return [...preferredIncluded, ...others]
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

  if (table === TABLES.images.key) {
    payload.modified_datetime_utc = new Date().toISOString()
  }

  if (table === TABLES.whitelistedEmailAddresses.key) {
    if ('email' in payload && !('email_address' in payload)) {
      payload.email_address = payload.email
      delete payload.email
    }
    payload.modified_datetime_utc = new Date().toISOString()
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

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function ReadTable({ rows, preferred }: { rows: GenericRow[]; preferred?: string[] }) {
  const columns = discoverColumns(rows, preferred)

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
          {rows.map((row, index) => (
            <tr key={asText(row.id) || index} className="border-t border-slate-100 align-top">
              {columns.map((column) => (
                <td key={`${index}-${column}`} className="max-w-[320px] px-3 py-2">
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

function CrudSection({ table, title, subtitle, rows, includeCreate = true, preferred }: { table: string; title: string; subtitle: string; rows: GenericRow[]; includeCreate?: boolean; preferred?: string[] }) {
  return (
    <Section title={title} subtitle={subtitle}>
      {includeCreate ? (
        <form action={createGenericRow} className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input type="hidden" name="table" value={table} />
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Create JSON payload</label>
          <textarea className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs" defaultValue="{}" name="payload" rows={4} />
          <button className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" type="submit">
            Create Row
          </button>
        </form>
      ) : null}

      <ReadTable preferred={preferred} rows={rows} />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map((row, index) => {
          const id = asText(row.id)
          if (!id) return null

          return (
            <article key={id || index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Row ID: {id}</p>

              <form action={updateGenericRow} className="space-y-2">
                <input type="hidden" name="table" value={table} />
                <input type="hidden" name="id" value={id} />
                <textarea className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs" defaultValue={JSON.stringify(row, null, 2)} name="payload" rows={8} />
                <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700" type="submit">
                  Update
                </button>
              </form>

              <form action={deleteGenericRow} className="mt-2">
                <input type="hidden" name="table" value={table} />
                <input type="hidden" name="id" value={id} />
                <button className="rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700" type="submit">
                  Delete
                </button>
              </form>
            </article>
          )
        })}
      </div>
    </Section>
  )
}

export default async function Home() {
  const supabase = createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const fetchTable = async (config: TableConfig): Promise<TableResult> => {
    try {
      let query = supabase.from(config.key).select('*')
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

        <CrudSection includeCreate={false} rows={images.rows} subtitle="Create image rows using the quick upload form, then update/delete existing rows below." table={images.resolvedTable} title="Images (Create / Read / Update / Delete)" />

        <Section title="Upload New Image" subtitle="Create new image records using URL + optional description/profile.">
          <form action={createImageRow} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            <input className="rounded-md border border-slate-300 px-3 py-2" name="url" placeholder="https://image-url" required />
            <input className="rounded-md border border-slate-300 px-3 py-2" name="description" placeholder="description" />
            <input className="rounded-md border border-slate-300 px-3 py-2" name="profile_id" placeholder="profile_id (optional)" />
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 md:col-span-3" type="submit">
              Upload New Image Row
            </button>
          </form>
        </Section>

        <Section title="Users / Profiles (Read)" subtitle="Read users from the profiles table.">
          <ReadTable preferred={['id', 'email', 'is_superadmin', 'created_datetime_utc']} rows={profiles.rows} />
        </Section>

        <Section title="Humor Flavors (Read)" subtitle="Read humor flavor records.">
          <ReadTable rows={humorFlavors.rows} />
        </Section>

        <Section title="Humor Flavor Steps (Read)" subtitle="Read humor flavor steps.">
          <ReadTable rows={humorFlavorSteps.rows} />
        </Section>

        <CrudSection includeCreate={false} rows={humorFlavorMix.rows} subtitle="Read and update humor mix rows." table={humorFlavorMix.resolvedTable} title="Humor Mix (Read / Update)" />
        <CrudSection rows={terms.rows} subtitle="Create, read, update, and delete terms." table={terms.resolvedTable} title="Terms (CRUD)" />

        <Section title="Captions (Read)" subtitle="Read captions.">
          <ReadTable rows={captions.rows} />
        </Section>

        <Section title="Caption Requests (Read)" subtitle="Read caption requests.">
          <ReadTable rows={captionRequests.rows} />
        </Section>

        <CrudSection rows={captionExamples.rows} subtitle="Create, read, update, and delete caption examples." table={captionExamples.resolvedTable} title="Caption Examples (CRUD)" />
        <CrudSection rows={llmModels.rows} subtitle="Create, read, update, and delete llm models." table={llmModels.resolvedTable} title="LLM Models (CRUD)" />
        <CrudSection rows={llmProviders.rows} subtitle="Create, read, update, and delete llm providers." table={llmProviders.resolvedTable} title="LLM Providers (CRUD)" />

        <Section title="LLM Prompt Chains (Read)" subtitle="Read prompt chain definitions.">
          <ReadTable rows={llmPromptChains.rows} />
        </Section>

        <Section title="LLM Model Responses (Read)" subtitle="Read stored model responses.">
          <ReadTable rows={llmResponses.rows} />
        </Section>

        <CrudSection rows={allowedSignupDomains.rows} subtitle="Create, read, update, and delete allowed signup domains." table={allowedSignupDomains.resolvedTable} title="Allowed Signup Domains (CRUD)" />

        <CrudSection
          rows={whitelistedEmailAddresses.rows}
          subtitle="Create, read, update, and delete whitelist email addresses using email_address + datetime columns."
          table={whitelistedEmailAddresses.resolvedTable}
          title="Whitelist Email Addresses (CRUD)"
          preferred={['id', 'email_address', 'created_datetime_utc', 'modified_datetime_utc']}
        />
      </main>
    </div>
  )
}
