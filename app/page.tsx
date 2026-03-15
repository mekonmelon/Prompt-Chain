import Image from 'next/image'
import type { ReactNode } from 'react'
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
}

type NavItem = {
  id: string
  label: string
  description: string
}

type NavGroup = {
  title: string
  items: NavItem[]
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

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard', description: 'Studio activity and health.' }]
  },
  {
    title: 'Content',
    items: [
      { id: 'images', label: 'Images', description: 'Media inventory and upload operations.' },
      { id: 'captions', label: 'Captions', description: 'Caption content and voting context.' },
      { id: 'caption-requests', label: 'Caption Requests', description: 'Generation queue and request flow.' },
      { id: 'caption-examples', label: 'Caption Examples', description: 'Example library for quality tuning.' },
      { id: 'terms', label: 'Terms', description: 'Moderation and exclusion rules.' }
    ]
  },
  {
    title: 'Humor Pipeline',
    items: [
      { id: 'flavors', label: 'Flavors', description: 'Humor flavor catalog.' },
      { id: 'flavor-steps', label: 'Flavor Steps', description: 'Prompt step definitions per flavor.' },
      { id: 'humor-mix', label: 'Humor Mix', description: 'Default flavor blend configuration.' }
    ]
  },
  {
    title: 'AI / LLM',
    items: [
      { id: 'models', label: 'Models', description: 'Model registry and settings.' },
      { id: 'providers', label: 'Providers', description: 'Provider configuration and usage.' },
      { id: 'prompt-chains', label: 'Prompt Chains', description: 'Pipeline chain definitions.' },
      { id: 'responses', label: 'Responses', description: 'Model response logs.' }
    ]
  },
  {
    title: 'Access',
    items: [
      { id: 'users', label: 'Users', description: 'Profiles and superadmin status.' },
      { id: 'allowed-domains', label: 'Allowed Domains', description: 'Signup allowlist by domain.' },
      { id: 'whitelisted-emails', label: 'Whitelisted Emails', description: 'Email-level access allowlist.' }
    ]
  }
]

function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
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

function getCaptionText(row: GenericRow) {
  return asText(row.caption_text || row.content || row.text)
}

function getChartDay(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

function isViewValid(view: string) {
  return NAV_GROUPS.some((group) => group.items.some((item) => item.id === view))
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
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

async function signOut() {
  'use server'
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
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

  const selectedViewParam = asText(Array.isArray(searchParams?.view) ? searchParams?.view[0] : searchParams?.view)
  const selectedView = isViewValid(selectedViewParam) ? selectedViewParam : 'dashboard'

  const fetchTable = async (config: TableConfig): Promise<TableResult> => {
    try {
      let query = supabase.from(config.key).select('*').limit(50)
      if (config.sortColumn) {
        query = query.order(config.sortColumn, { ascending: false })
      }

      const { data, error } = await query

      if (error) {
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

  const [
    { count: totalUsersCount },
    { count: totalImagesCount },
    { count: totalCaptionsCount },
    { count: totalRequestsCount },
    { count: totalFlavorCount },
    { count: totalModelsCount },
    { count: totalProvidersCount },
    { count: totalDomainsCount },
    { count: totalWhitelistCount }
  ] = await Promise.all([
    supabase.from(TABLES.profiles.key).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.images.key).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.captions.key).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.captionRequests.key).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.humorFlavors.key).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.llmModels.key).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.llmProviders.key).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.allowedSignupDomains.key).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.whitelistedEmailAddresses.key).select('*', { count: 'exact', head: true })
  ])

  const totalUsers = totalUsersCount ?? 0
  const totalImages = totalImagesCount ?? 0
  const totalCaptions = totalCaptionsCount ?? 0
  const totalRequests = totalRequestsCount ?? 0
  const totalFlavors = totalFlavorCount ?? 0
  const totalModels = totalModelsCount ?? 0
  const totalProviders = totalProvidersCount ?? 0
  const totalDomains = totalDomainsCount ?? 0
  const totalWhitelistEmails = totalWhitelistCount ?? 0
  const avgCaptionsPerImage = totalImages ? (totalCaptions / totalImages).toFixed(2) : '0.00'

  const { data: topCaptionCandidates } = await supabase
    .from(TABLES.captions.key)
    .select('id, content, image_id, created_datetime_utc')
    .order('created_datetime_utc', { ascending: false })
    .limit(200)

  const topCaptionRows = (topCaptionCandidates ?? []) as GenericRow[]
  const candidateCaptionIds = topCaptionRows.map((row) => getRowId(row)).filter(Boolean)

  const { data: voteRows } = candidateCaptionIds.length
    ? await supabase.from('caption_votes').select('caption_id, vote_value').in('caption_id', candidateCaptionIds)
    : { data: [] as GenericRow[] }

  const voteRowsSafe = (voteRows ?? []) as GenericRow[]
  const votesByCaption = voteRowsSafe.reduce<Record<string, number>>((acc, vote) => {
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
        imageId: asText(caption.image_id),
        text: getCaptionText(caption),
        votes: id ? votesByCaption[id] ?? 0 : 0
      }
    })
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5)

  const imagePreviewById = new Map<string, string>()
  images.rows.forEach((row) => {
    const id = getRowId(row)
    const preview = asText(row.url || row.image_url || row.image_src || row.public_url)
    if (id && preview) imagePreviewById.set(id, preview)
  })

  const today = new Date()
  const dateSeries = [...Array(7)].map((_, idx) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - idx))
    const key = date.toISOString().slice(0, 10)
    return { key, label: getChartDay(date), value: 0 }
  })
  const dateIndex = new Map(dateSeries.map((day, index) => [day.key, index]))

  topCaptionRows.forEach((row) => {
    const raw = asText(row.created_datetime_utc)
    const key = raw.slice(0, 10)
    const idx = dateIndex.get(key)
    if (idx !== undefined) {
      dateSeries[idx].value += 1
    }
  })

  const maxActivity = Math.max(...dateSeries.map((day) => day.value), 1)

  const upvotes = voteRowsSafe.filter((row) => getVoteValue(row) > 0).length
  const downvotes = voteRowsSafe.filter((row) => getVoteValue(row) < 0).length
  const netVotes = voteRowsSafe.reduce((sum, row) => sum + getVoteValue(row), 0)

  const selectedItem = NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === selectedView)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-800 bg-slate-900/90 px-4 py-6 lg:border-b-0 lg:border-r">
          <div className="mb-6 rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">Studio Console</p>
            <h1 className="mt-2 text-xl font-bold text-white">The Humor Project</h1>
            <p className="mt-1 text-xs text-slate-300">Creative operations and moderation workspace.</p>
          </div>

          <nav className="space-y-5">
            {NAV_GROUPS.map((group) => (
              <section key={group.title}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = selectedView === item.id
                    return (
                      <a
                        key={item.id}
                        className={`block rounded-xl px-3 py-2 text-sm transition ${
                          active ? 'bg-indigo-500/20 text-indigo-100 ring-1 ring-indigo-400/40' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                        href={`/?view=${item.id}`}
                      >
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs text-slate-400">{item.description}</div>
                      </a>
                    )
                  })}
                </div>
              </section>
            ))}
          </nav>
        </aside>

        <div className="bg-slate-100 text-slate-900">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex w-[95%] max-w-6xl items-center justify-between py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{selectedItem?.label ?? 'Dashboard'}</p>
                <h2 className="text-2xl font-bold text-slate-900">Welcome back, {user?.email ?? 'Admin'}.</h2>
              </div>
              <form action={signOut}>
                <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700" type="submit">
                  Sign Out
                </button>
              </form>
            </div>
          </header>

          <main className="mx-auto grid w-[95%] max-w-6xl gap-6 py-8">
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

            {selectedView === 'dashboard' ? (
              <>
                <SectionCard
                  title="Humor Studio Pulse"
                  subtitle="A live editorial view of your caption pipeline, creative throughput, and moderation readiness."
                >
                  <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-500 to-violet-500 p-5 text-white">
                      <p className="text-xs uppercase tracking-[0.2em] text-indigo-100">Overview Brief</p>
                      <h3 className="mt-2 text-2xl font-bold">Creative Ops Studio</h3>
                      <p className="mt-2 max-w-xl text-sm text-indigo-100">
                        Track caption quality, generation throughput, and governance controls from one unified workspace for the Humor Project team.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pipeline Coverage</p>
                        <p className="mt-2 text-2xl font-bold">{totalFlavors}</p>
                        <p className="text-xs text-slate-500">Flavors configured</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access Controls</p>
                        <p className="mt-2 text-2xl font-bold">{totalDomains + totalWhitelistEmails}</p>
                        <p className="text-xs text-slate-500">Domain + email rules</p>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: 'Total Users', value: totalUsers, tone: 'from-blue-50 to-indigo-50', text: 'text-blue-700' },
                    { label: 'Total Images', value: totalImages, tone: 'from-violet-50 to-fuchsia-50', text: 'text-violet-700' },
                    { label: 'Total Captions', value: totalCaptions, tone: 'from-emerald-50 to-teal-50', text: 'text-emerald-700' },
                    { label: 'Avg Captions / Image', value: avgCaptionsPerImage, tone: 'from-amber-50 to-orange-50', text: 'text-amber-700' }
                  ].map((metric) => (
                    <article key={metric.label} className={`rounded-2xl border border-slate-200 bg-gradient-to-br ${metric.tone} p-5 shadow-sm`}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{metric.label}</p>
                      <p className={`mt-2 text-3xl font-bold ${metric.text}`}>{metric.value}</p>
                    </article>
                  ))}
                </section>

                <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {[
                    { label: 'Caption Requests', value: totalRequests },
                    { label: 'Flavor Steps (loaded)', value: humorFlavorSteps.rows.length },
                    { label: 'Humor Mix Rows', value: humorFlavorMix.rows.length },
                    { label: 'LLM Models', value: totalModels },
                    { label: 'LLM Providers', value: totalProviders },
                    { label: 'Terms', value: terms.rows.length }
                  ].map((stat) => (
                    <article key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">{stat.value}</p>
                    </article>
                  ))}
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                  <SectionCard title="Top Captions" subtitle="Ranked by net vote score (upvotes minus downvotes).">
                    <div className="space-y-3">
                      {topCaptions.length ? (
                        topCaptions.map((caption) => {
                          const previewUrl = imagePreviewById.get(caption.imageId)
                          return (
                            <article key={caption.id || caption.text} className="grid grid-cols-[72px_1fr_auto] gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
                                {previewUrl ? <Image alt="Caption preview" className="h-full w-full object-cover" height={64} src={previewUrl} unoptimized width={64} /> : <div className="flex h-full items-center justify-center text-[10px] text-slate-500">No image preview</div>}
                              </div>
                              <div>
                                <p className="line-clamp-2 text-sm font-semibold text-slate-900">{caption.text || 'No caption content available.'}</p>
                                <p className="mt-1 text-xs text-slate-500">Caption ID: {caption.id || 'unknown'}</p>
                              </div>
                              <span className="h-fit rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">{caption.votes} score</span>
                            </article>
                          )
                        })
                      ) : (
                        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">No caption vote data available yet.</p>
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard title="Caption Activity (7 days)" subtitle="Recent caption creation activity from latest loaded caption records.">
                    <div className="space-y-3">
                      {dateSeries.map((day) => {
                        const widthPct = Math.max((day.value / maxActivity) * 100, day.value > 0 ? 8 : 2)
                        return (
                          <div key={day.key} className="grid grid-cols-[40px_1fr_32px] items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">{day.label}</span>
                            <div className="h-3 rounded-full bg-slate-200">
                              <div className="h-3 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${widthPct}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-600">{day.value}</span>
                          </div>
                        )
                      })}
                    </div>
                  </SectionCard>
                </section>

                <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                  <SectionCard title="Vote & Request Summary" subtitle="Operational quality signals from vote balance and request throughput.">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-emerald-700">Upvotes</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-800">{upvotes}</p>
                      </article>
                      <article className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-rose-700">Downvotes</p>
                        <p className="mt-1 text-2xl font-bold text-rose-800">{downvotes}</p>
                      </article>
                      <article className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-indigo-700">Net Vote</p>
                        <p className="mt-1 text-2xl font-bold text-indigo-800">{netVotes}</p>
                      </article>
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Queue Status</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{totalRequests} requests tracked</p>
                      <p className="text-xs text-slate-500">Use Caption Requests workspace for triage and monitoring.</p>
                    </div>
                  </SectionCard>

                  <SectionCard title="Quick Navigation" subtitle="Jump to high-impact workspaces.">
                    <div className="grid gap-2">
                      {[
                        { label: 'Images', view: 'images', hint: 'Upload and moderate image records.' },
                        { label: 'Caption Requests', view: 'caption-requests', hint: 'Triage request pipeline.' },
                        { label: 'Flavors', view: 'flavors', hint: 'Adjust humor strategy.' },
                        { label: 'Models', view: 'models', hint: 'Manage LLM capabilities.' },
                        { label: 'Users', view: 'users', hint: 'Review admin access.' },
                        { label: 'Whitelisted Emails', view: 'whitelisted-emails', hint: 'Refine invite permissions.' }
                      ].map((link) => (
                        <a key={link.view} className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-indigo-300 hover:bg-indigo-50" href={`/?view=${link.view}`}>
                          <p className="text-sm font-semibold text-slate-900">{link.label}</p>
                          <p className="text-xs text-slate-500">{link.hint}</p>
                        </a>
                      ))}
                    </div>
                  </SectionCard>
                </section>
              </>
            ) : (
              <SectionCard title={selectedItem?.label ?? 'Workspace'} subtitle={selectedItem?.description ?? 'Section workspace'}>
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                  <p className="text-sm font-semibold text-slate-700">Phase 3 placeholder</p>
                  <p className="mt-1 text-sm text-slate-600">
                    This workspace shell is ready. The dedicated CRUD/read modules for <span className="font-semibold">{selectedItem?.label ?? selectedView}</span> will plug into this panel in the next phase.
                  </p>
                </div>
              </SectionCard>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
