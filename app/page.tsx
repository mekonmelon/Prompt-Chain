import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ThemeToggle } from '@/components/studio/theme-toggle'
import { PromptChainStudioSection } from '@/components/sections/prompt-chain-studio-section'
import {
  asNumber,
  asText,
  FLAVOR_ACTIVE_KEYS,
  FLAVOR_DESCRIPTION_KEYS,
  FLAVOR_NAME_KEYS,
  FLAVOR_RELATION_KEYS,
  GenericRow,
  getFlavorId,
  getFlavorName,
  getRowId,
  getStepFlavorId,
  getStepOrder,
  hasStudioAccess,
  moveItem,
  pickFirstKey,
  resequenceRows,
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
import { createClient } from '@/lib/supabase/server'

type TableResult = {
  rows: GenericRow[]
  error: string | null
}

type ViewId = 'overview' | 'flavors' | 'steps' | 'test-runner' | 'results' | 'audit'

type NavItem = {
  id: ViewId
  label: string
  description: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', description: 'Prompt-chain summary, studio stats, and quick actions.' },
  { id: 'flavors', label: 'Flavors', description: 'Create, edit, duplicate, and remove humor flavors.' },
  { id: 'steps', label: 'Steps', description: 'Maintain ordered humor_flavor_steps for the selected flavor.' },
  { id: 'test-runner', label: 'Test Runner', description: 'Send a flavor + image source to the Humor Project REST API.' },
  { id: 'results', label: 'Results / Captions', description: 'Inspect captions produced for the selected flavor.' },
  { id: 'audit', label: 'Audit Trail', description: 'Read-only llm_prompt_chains and llm_model_responses debugging view.' }
]

const TABLES = {
  profiles: 'profiles',
  flavors: 'humor_flavors',
  steps: 'humor_flavor_steps',
  mixes: 'humor_flavor_mix',
  captions: 'captions',
  images: 'images',
  promptChains: 'llm_prompt_chains',
  responses: 'llm_model_responses'
} as const

function isView(value: string): value is ViewId {
  return NAV_ITEMS.some((item) => item.id === value)
}

function buildOptionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text || null
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
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const supabase = createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from(TABLES.profiles)
    .select('id, email, is_superadmin, is_matrix_admin')
    .eq('id', user.id)
    .single()

  if (!hasStudioAccess(profile as GenericRow | null | undefined)) {
    redirect('/unauthorized')
  }

  const selectedViewRaw = asText(Array.isArray(searchParams?.view) ? searchParams?.view[0] : searchParams?.view)
  const selectedView: ViewId = isView(selectedViewRaw) ? selectedViewRaw : 'overview'

  const fetchTable = async (table: string, options?: { orderBy?: string; ascending?: boolean; limit?: number }): Promise<TableResult> => {
    try {
      let query = supabase.from(table).select('*').limit(options?.limit ?? 200)
      if (options?.orderBy) {
        query = query.order(options.orderBy, { ascending: options.ascending ?? false })
      }
      const { data, error } = await query
      if (error) return { rows: [], error: `${table}: ${error.message}` }
      return { rows: (data ?? []) as GenericRow[], error: null }
    } catch (error) {
      return { rows: [], error: `${table}: ${error instanceof Error ? error.message : 'Unknown fetch error'}` }
    }
  }

  const [flavorsResult, stepsResult, mixesResult, captionsResult, imagesResult, promptChainsResult, responsesResult] = await Promise.all([
    fetchTable(TABLES.flavors, { orderBy: 'modified_datetime_utc' }),
    fetchTable(TABLES.steps, { orderBy: 'modified_datetime_utc' }),
    fetchTable(TABLES.mixes, { orderBy: 'modified_datetime_utc' }),
    fetchTable(TABLES.captions, { orderBy: 'created_datetime_utc' }),
    fetchTable(TABLES.images, { orderBy: 'created_datetime_utc' }),
    fetchTable(TABLES.promptChains, { orderBy: 'created_datetime_utc' }),
    fetchTable(TABLES.responses, { orderBy: 'created_datetime_utc' })
  ])

  const allErrors = [
    flavorsResult.error,
    stepsResult.error,
    mixesResult.error,
    captionsResult.error,
    imagesResult.error,
    promptChainsResult.error,
    responsesResult.error
  ].filter(Boolean)

  const flavors = flavorsResult.rows
  const steps = stepsResult.rows
  const mixes = mixesResult.rows
  const captions = captionsResult.rows
  const images = imagesResult.rows
  const promptChains = promptChainsResult.rows
  const responses = responsesResult.rows

  const flavorNameKey = pickFirstKey(flavors, FLAVOR_NAME_KEYS) ?? 'name'
  const flavorDescriptionKey = pickFirstKey(flavors, FLAVOR_DESCRIPTION_KEYS)
  const flavorActiveKey = pickFirstKey(flavors, FLAVOR_ACTIVE_KEYS)
  const stepRelationKey = pickFirstKey(steps, FLAVOR_RELATION_KEYS) ?? 'flavor_id'
  const stepOrderKey = pickFirstKey(steps, STEP_ORDER_KEYS) ?? 'step_order'
  const stepTitleKey = pickFirstKey(steps, STEP_TITLE_KEYS) ?? 'step_title'
  const stepBodyKey = pickFirstKey(steps, STEP_BODY_KEYS)
  const stepSystemPromptKey = pickFirstKey(steps, STEP_SYSTEM_PROMPT_KEYS)
  const stepUserPromptKey = pickFirstKey(steps, STEP_USER_PROMPT_KEYS)
  const stepInputTypeKey = pickFirstKey(steps, STEP_INPUT_TYPE_KEYS)
  const stepOutputTypeKey = pickFirstKey(steps, STEP_OUTPUT_TYPE_KEYS)
  const stepTemperatureKey = pickFirstKey(steps, STEP_TEMPERATURE_KEYS)
  const stepModelKey = pickFirstKey(steps, STEP_MODEL_KEYS)
  const stepActiveKey = pickFirstKey(steps, STEP_ACTIVE_KEYS)

  async function createFlavor(formData: FormData) {
    'use server'
    const supabase = createClient()
    const name = String(formData.get('name') ?? '').trim()
    if (!name || !profile?.id) return

    const payload: GenericRow = {
      [flavorNameKey]: name,
      created_by_user_id: profile.id,
      modified_by_user_id: profile.id
    }

    if (flavorDescriptionKey) {
      payload[flavorDescriptionKey] = buildOptionalString(formData.get('description'))
    }
    if (flavorActiveKey) {
      payload[flavorActiveKey] = Boolean(formData.get('is_active'))
    }

    await supabase.from(TABLES.flavors).insert(payload)
    revalidatePath('/')
  }

  async function updateFlavor(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    const name = String(formData.get('name') ?? '').trim()
    if (!id || !name || !profile?.id) return

    const payload: GenericRow = {
      [flavorNameKey]: name,
      modified_by_user_id: profile.id
    }

    if (flavorDescriptionKey) {
      payload[flavorDescriptionKey] = buildOptionalString(formData.get('description'))
    }
    if (flavorActiveKey) {
      payload[flavorActiveKey] = Boolean(formData.get('is_active'))
    }

    await supabase.from(TABLES.flavors).update(payload).eq('id', id)
    revalidatePath('/')
  }

  async function deleteFlavor(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    if (!id) return

    await supabase.from(TABLES.flavors).delete().eq('id', id)
    revalidatePath('/')
  }

  async function duplicateFlavor(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    if (!id || !profile?.id) return

    const sourceFlavor = flavors.find((row) => getFlavorId(row) === id)
    if (!sourceFlavor) return

    const flavorPayload: GenericRow = {
      [flavorNameKey]: `${getFlavorName(sourceFlavor)} Copy`,
      created_by_user_id: profile.id,
      modified_by_user_id: profile.id
    }

    if (flavorDescriptionKey && flavorDescriptionKey in sourceFlavor) {
      flavorPayload[flavorDescriptionKey] = sourceFlavor[flavorDescriptionKey]
    }
    if (flavorActiveKey && flavorActiveKey in sourceFlavor) {
      flavorPayload[flavorActiveKey] = sourceFlavor[flavorActiveKey]
    }

    const { data: insertedFlavor } = await supabase.from(TABLES.flavors).insert(flavorPayload).select('id').single()
    if (!insertedFlavor?.id) {
      revalidatePath('/')
      return
    }

    const relatedSteps = sortSteps(steps.filter((row) => getStepFlavorId(row) === id))
    if (relatedSteps.length) {
      const stepPayloads = relatedSteps.map((step, index) => {
        const payload: GenericRow = {
          [stepRelationKey]: insertedFlavor.id,
          [stepOrderKey]: index + 1,
          created_by_user_id: profile.id,
          modified_by_user_id: profile.id
        }

        ;[
          stepTitleKey,
          stepBodyKey,
          stepSystemPromptKey,
          stepUserPromptKey,
          stepInputTypeKey,
          stepOutputTypeKey,
          stepTemperatureKey,
          stepModelKey,
          stepActiveKey
        ].forEach((key) => {
          if (key && key in step) payload[key] = step[key]
        })

        return payload
      })

      await supabase.from(TABLES.steps).insert(stepPayloads)
    }

    revalidatePath('/')
  }

  async function createStep(formData: FormData) {
    'use server'
    const supabase = createClient()
    const flavorId = String(formData.get('flavor_id') ?? '').trim()
    if (!flavorId || !profile?.id) return

    const currentSteps = sortSteps(steps.filter((row) => getStepFlavorId(row) === flavorId))
    const nextOrder = (currentSteps.at(-1) ? getStepOrder(currentSteps.at(-1) as GenericRow) : 0) + 1

    const payload: GenericRow = {
      [stepRelationKey]: flavorId,
      [stepOrderKey]: nextOrder,
      created_by_user_id: profile.id,
      modified_by_user_id: profile.id
    }

    payload[stepTitleKey] = buildOptionalString(formData.get('step_title'))
    if (stepBodyKey) payload[stepBodyKey] = buildOptionalString(formData.get('step_body'))
    if (stepSystemPromptKey) payload[stepSystemPromptKey] = buildOptionalString(formData.get('system_prompt'))
    if (stepUserPromptKey) payload[stepUserPromptKey] = buildOptionalString(formData.get('user_prompt'))
    if (stepInputTypeKey) payload[stepInputTypeKey] = buildOptionalString(formData.get('input_type'))
    if (stepOutputTypeKey) payload[stepOutputTypeKey] = buildOptionalString(formData.get('output_type'))
    if (stepTemperatureKey) payload[stepTemperatureKey] = asNumber(formData.get('temperature'))
    if (stepModelKey) payload[stepModelKey] = buildOptionalString(formData.get('model_link'))
    if (stepActiveKey) payload[stepActiveKey] = Boolean(formData.get('is_active'))

    await supabase.from(TABLES.steps).insert(payload)
    revalidatePath('/')
  }

  async function updateStep(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    if (!id || !profile?.id) return

    const payload: GenericRow = {
      modified_by_user_id: profile.id,
      [stepTitleKey]: buildOptionalString(formData.get('step_title'))
    }

    const order = asNumber(formData.get('step_order'))
    if (order !== null) payload[stepOrderKey] = order
    if (stepBodyKey) payload[stepBodyKey] = buildOptionalString(formData.get('step_body'))
    if (stepSystemPromptKey) payload[stepSystemPromptKey] = buildOptionalString(formData.get('system_prompt'))
    if (stepUserPromptKey) payload[stepUserPromptKey] = buildOptionalString(formData.get('user_prompt'))
    if (stepInputTypeKey) payload[stepInputTypeKey] = buildOptionalString(formData.get('input_type'))
    if (stepOutputTypeKey) payload[stepOutputTypeKey] = buildOptionalString(formData.get('output_type'))
    if (stepTemperatureKey) payload[stepTemperatureKey] = asNumber(formData.get('temperature'))
    if (stepModelKey) payload[stepModelKey] = buildOptionalString(formData.get('model_link'))
    if (stepActiveKey) payload[stepActiveKey] = Boolean(formData.get('is_active'))

    await supabase.from(TABLES.steps).update(payload).eq('id', id)
    revalidatePath('/')
  }

  async function deleteStep(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    if (!id) return

    await supabase.from(TABLES.steps).delete().eq('id', id)
    revalidatePath('/')
  }

  async function reorderStep(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    const direction = String(formData.get('direction') ?? '').trim()
    if (!id || !profile?.id || !['up', 'down'].includes(direction)) return

    const target = steps.find((row) => getRowId(row) === id)
    if (!target) return

    const flavorId = getStepFlavorId(target)
    const siblings = sortSteps(steps.filter((row) => getStepFlavorId(row) === flavorId))
    const currentIndex = siblings.findIndex((row) => getRowId(row) === id)
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const reordered = resequenceRows(moveItem(siblings, currentIndex, nextIndex), stepOrderKey)

    await Promise.all(
      reordered.map((row) =>
        supabase
          .from(TABLES.steps)
          .update({ [stepOrderKey]: row[stepOrderKey], modified_by_user_id: profile.id })
          .eq('id', getRowId(row))
      )
    )

    revalidatePath('/')
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto grid min-h-screen max-w-[1700px] grid-cols-1 xl:grid-cols-[290px_1fr]">
        <aside className="border-b border-[var(--shell-border)] bg-[var(--shell)] px-4 py-6 xl:border-b-0 xl:border-r">
          <div className="rounded-3xl border border-indigo-500/25 bg-[linear-gradient(135deg,rgba(79,70,229,0.18),rgba(17,24,39,0.12))] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300">Assignment 8</p>
            <h1 className="mt-2 text-2xl font-bold text-white">Prompt Chain Studio</h1>
            <p className="mt-2 text-sm text-slate-300">A matrix-like builder for humor flavors, ordered steps, flavor testing, and caption review.</p>
          </div>

          <nav className="mt-6 space-y-2">
            {NAV_ITEMS.map((item) => {
              const active = item.id === selectedView
              return (
                <a
                  key={item.id}
                  href={`/?view=${item.id}`}
                  className={`block rounded-2xl border px-4 py-3 transition ${
                    active
                      ? 'border-indigo-400/40 bg-indigo-500/15 text-white shadow-sm'
                      : 'border-transparent text-slate-300 hover:border-[var(--shell-border)] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                </a>
              )
            })}
          </nav>
        </aside>

        <div>
          <header className="sticky top-0 z-20 border-b border-[var(--panel-border)] bg-[color:var(--background)/0.92] backdrop-blur">
            <div className="mx-auto flex w-[95%] max-w-7xl flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">Prompt Chain Studio / {NAV_ITEMS.find((item) => item.id === selectedView)?.label}</p>
                <h2 className="mt-2 text-3xl font-bold">Welcome back, {asText(profile?.email || user.email) || 'Studio Admin'}.</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">Access granted because your profile is marked as superadmin or matrix admin.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ThemeToggle />
                <form action={signOut}>
                  <button className="rounded-full bg-[var(--foreground)] px-5 py-2 text-sm font-semibold text-[var(--background)]" type="submit">Sign out</button>
                </form>
              </div>
            </div>
          </header>

          <main className="mx-auto grid w-[95%] max-w-7xl gap-6 py-8">
            {allErrors.length ? (
              <section className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-5 text-rose-200">
                <h3 className="text-lg font-semibold">Fetch warnings</h3>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {allErrors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <PromptChainStudioSection
              captions={captions}
              createFlavor={createFlavor}
              createStep={createStep}
              deleteFlavor={deleteFlavor}
              deleteStep={deleteStep}
              duplicateFlavor={duplicateFlavor}
              flavors={flavors}
              images={images}
              mixes={mixes}
              promptChains={promptChains}
              reorderStep={reorderStep}
              responses={responses}
              selectedView={selectedView}
              steps={steps}
              updateFlavor={updateFlavor}
              updateStep={updateStep}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
