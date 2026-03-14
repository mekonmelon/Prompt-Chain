import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type GenericRow = Record<string, unknown>

type TableResult = {
  rows: GenericRow[]
  error: string | null
}

const TABLES = {
  profiles: 'profiles',
  images: 'images',
  humorFlavors: 'humor_flavors',
  humorFlavorSteps: 'humor_flavor_steps',
  humorFlavorMix: 'humor_flavor_mix',
  terms: 'terms',
  captions: 'captions',
  captionRequests: 'caption_requests',
  captionExamples: 'caption_examples',
  llmModels: 'llm_models',
  llmProviders: 'llm_providers',
  llmPromptChains: 'llm_prompt_chains',
  llmResponses: 'llm_responses',
  allowedSignupDomains: 'allowed_signup_domains',
  whitelistedEmailAddresses: 'whitelisted_email_addresses'
} as const

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

async function createGenericRow(formData: FormData) {
  'use server'
  const supabase = createClient()
  const table = String(formData.get('table') ?? '')
  if (!table) return

  const payload = parsePayload(formData.get('payload'))
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
  const userId = String(formData.get('user_id') ?? '').trim() || user?.id
  if (!url) return

  const payload: GenericRow = { url, description }
  if (userId) payload.user_id = userId

  await supabase.from(TABLES.images).insert(payload)
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

function CrudSection({
  table,
  title,
  subtitle,
  rows,
  includeCreate = true,
  preferred
}: {
  table: string
  title: string
  subtitle: string
  rows: GenericRow[]
  includeCreate?: boolean
  preferred?: string[]
}) {
  return (
    <Section title={title} subtitle={subtitle}>
      {includeCreate ? (
        <form action={createGenericRow} className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input type="hidden" name="table" value={table} />
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Create JSON payload</label>
          <textarea
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
            defaultValue="{}"
            name="payload"
            rows={4}
          />
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
                <textarea
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
                  defaultValue={JSON.stringify(row, null, 2)}
                  name="payload"
                  rows={8}
                />
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

  const fetch = async (table: string): Promise<TableResult> => {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false })
    return {
      rows: (data ?? []) as GenericRow[],
      error: error?.message ?? null
    }
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
  ] = await Promise.all([
    fetch(TABLES.profiles),
    fetch(TABLES.images),
    fetch(TABLES.humorFlavors),
    fetch(TABLES.humorFlavorSteps),
    fetch(TABLES.humorFlavorMix),
    fetch(TABLES.terms),
    fetch(TABLES.captions),
    fetch(TABLES.captionRequests),
    fetch(TABLES.captionExamples),
    fetch(TABLES.llmModels),
    fetch(TABLES.llmProviders),
    fetch(TABLES.llmPromptChains),
    fetch(TABLES.llmResponses),
    fetch(TABLES.allowedSignupDomains),
    fetch(TABLES.whitelistedEmailAddresses)
  ])

  const allErrors = [
    [TABLES.profiles, profiles.error],
    [TABLES.images, images.error],
    [TABLES.humorFlavors, humorFlavors.error],
    [TABLES.humorFlavorSteps, humorFlavorSteps.error],
    [TABLES.humorFlavorMix, humorFlavorMix.error],
    [TABLES.terms, terms.error],
    [TABLES.captions, captions.error],
    [TABLES.captionRequests, captionRequests.error],
    [TABLES.captionExamples, captionExamples.error],
    [TABLES.llmModels, llmModels.error],
    [TABLES.llmProviders, llmProviders.error],
    [TABLES.llmPromptChains, llmPromptChains.error],
    [TABLES.llmResponses, llmResponses.error],
    [TABLES.allowedSignupDomains, allowedSignupDomains.error],
    [TABLES.whitelistedEmailAddresses, whitelistedEmailAddresses.error]
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

        <CrudSection
          includeCreate={false}
          rows={images.rows}
          subtitle="Create image rows using the quick upload form, then update/delete existing rows below."
          table={TABLES.images}
          title="Images (Create / Read / Update / Delete)"
        />

        <Section title="Upload New Image" subtitle="Create new image records using URL + optional description/user.">
          <form action={createImageRow} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            <input className="rounded-md border border-slate-300 px-3 py-2" name="url" placeholder="https://image-url" required />
            <input className="rounded-md border border-slate-300 px-3 py-2" name="description" placeholder="description" />
            <input className="rounded-md border border-slate-300 px-3 py-2" name="user_id" placeholder="user_id (optional)" />
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 md:col-span-3" type="submit">
              Upload New Image Row
            </button>
          </form>
        </Section>

        <Section title="Users / Profiles (Read)" subtitle="Read users from the profiles table.">
          <ReadTable preferred={['id', 'email', 'is_superadmin', 'created_at']} rows={profiles.rows} />
        </Section>

        <Section title="Humor Flavors (Read)" subtitle="Read humor flavor records.">
          <ReadTable rows={humorFlavors.rows} />
        </Section>

        <Section title="Humor Flavor Steps (Read)" subtitle="Read humor flavor steps.">
          <ReadTable rows={humorFlavorSteps.rows} />
        </Section>

        <CrudSection
          includeCreate={false}
          rows={humorFlavorMix.rows}
          subtitle="Read and update humor mix rows."
          table={TABLES.humorFlavorMix}
          title="Humor Mix (Read / Update)"
        />

        <CrudSection rows={terms.rows} subtitle="Create, read, update, and delete terms." table={TABLES.terms} title="Terms (CRUD)" />

        <Section title="Captions (Read)" subtitle="Read captions.">
          <ReadTable rows={captions.rows} />
        </Section>

        <Section title="Caption Requests (Read)" subtitle="Read caption requests.">
          <ReadTable rows={captionRequests.rows} />
        </Section>

        <CrudSection
          rows={captionExamples.rows}
          subtitle="Create, read, update, and delete caption examples."
          table={TABLES.captionExamples}
          title="Caption Examples (CRUD)"
        />

        <CrudSection
          rows={llmModels.rows}
          subtitle="Create, read, update, and delete llm models."
          table={TABLES.llmModels}
          title="LLM Models (CRUD)"
        />

        <CrudSection
          rows={llmProviders.rows}
          subtitle="Create, read, update, and delete llm providers."
          table={TABLES.llmProviders}
          title="LLM Providers (CRUD)"
        />

        <Section title="LLM Prompt Chains (Read)" subtitle="Read prompt chain definitions.">
          <ReadTable rows={llmPromptChains.rows} />
        </Section>

        <Section title="LLM Responses (Read)" subtitle="Read stored llm responses.">
          <ReadTable rows={llmResponses.rows} />
        </Section>

        <CrudSection
          rows={allowedSignupDomains.rows}
          subtitle="Create, read, update, and delete allowed signup domains."
          table={TABLES.allowedSignupDomains}
          title="Allowed Signup Domains (CRUD)"
        />

        <CrudSection
          rows={whitelistedEmailAddresses.rows}
          subtitle="Create, read, update, and delete whitelisted e-mail addresses."
          table={TABLES.whitelistedEmailAddresses}
          title="Whitelisted E-mail Addresses (CRUD)"
        />
      </main>
    </div>
  )
}
