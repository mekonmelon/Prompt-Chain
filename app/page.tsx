import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ThemeToggle } from '@/components/studio/theme-toggle'
import { PromptChainStudioSection } from '@/components/sections/prompt-chain-studio-section'
import {
  asNumber,
  asText,
  buildDuplicateSlug,
  FLAVOR_RELATION_KEYS,
  GenericRow,
  getFlavorDescription,
  getFlavorId,
  getFlavorSlug,
  getRowId,
  getStepFlavorId,
  getStepOrder,
  hasStudioAccess,
  moveItem,
  pickFirstKey,
  resequenceRows,
  slugify,
  sortSteps,
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

type FeedbackType = 'success' | 'error'

type StudioFeedback = {
  message: string
  scope: string
  type: FeedbackType
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

function buildRedirectUrl(view: ViewId, feedback?: StudioFeedback, selectedFlavorId?: string) {
  const params = new URLSearchParams({ view })

  if (feedback?.message) {
    params.set('feedback_message', feedback.message)
    params.set('feedback_scope', feedback.scope)
    params.set('feedback_type', feedback.type)
  }

  if (selectedFlavorId) {
    params.set('selected_flavor_id', selectedFlavorId)
  }

  return `/?${params.toString()}`
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
  const selectedFlavorId = asText(Array.isArray(searchParams?.selected_flavor_id) ? searchParams?.selected_flavor_id[0] : searchParams?.selected_flavor_id)

  const feedbackMessage = asText(Array.isArray(searchParams?.feedback_message) ? searchParams?.feedback_message[0] : searchParams?.feedback_message)
  const feedbackScope = asText(Array.isArray(searchParams?.feedback_scope) ? searchParams?.feedback_scope[0] : searchParams?.feedback_scope)
  const feedbackTypeRaw = asText(Array.isArray(searchParams?.feedback_type) ? searchParams?.feedback_type[0] : searchParams?.feedback_type)
  const feedbackType: FeedbackType = feedbackTypeRaw === 'success' ? 'success' : 'error'
  const feedback = feedbackMessage ? { message: feedbackMessage, scope: feedbackScope || 'flavors', type: feedbackType } : null

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

  const stepTitleKey = pickFirstKey(steps, STEP_TITLE_KEYS) ?? 'humor_flavor_step_type_id'
  const stepBodyKey = pickFirstKey(steps, STEP_BODY_KEYS) ?? 'description'
  const stepSystemPromptKey = pickFirstKey(steps, STEP_SYSTEM_PROMPT_KEYS) ?? 'llm_system_prompt'
  const stepUserPromptKey = pickFirstKey(steps, STEP_USER_PROMPT_KEYS) ?? 'llm_user_prompt'
  const stepInputTypeKey = pickFirstKey(steps, STEP_INPUT_TYPE_KEYS) ?? 'llm_input_type_id'
  const stepOutputTypeKey = pickFirstKey(steps, STEP_OUTPUT_TYPE_KEYS) ?? 'llm_output_type_id'
  const stepTemperatureKey = pickFirstKey(steps, STEP_TEMPERATURE_KEYS) ?? 'llm_temperature'
  const stepModelKey = pickFirstKey(steps, STEP_MODEL_KEYS) ?? 'llm_model_id'

  async function createFlavor(formData: FormData) {
    'use server'
    const supabase = createClient()
    const description = String(formData.get('description') ?? '').trim()
    const rawSlug = String(formData.get('slug') ?? '').trim()
    const slug = slugify(rawSlug)

    if (!profile?.id) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-create', message: 'You must be signed in as an authorized profile to create a flavor.' }))
    }

    if (!description || !slug) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-create', message: 'Create flavor requires both a description and a valid slug.' }))
    }

    try {
      const { data, error } = await supabase
        .from(TABLES.flavors)
        .insert({
          description,
          slug,
          created_by_user_id: profile.id,
          modified_by_user_id: profile.id
        })
        .select('id')
        .single()

      if (error) {
        redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-create', message: `Could not create flavor: ${error.message}` }))
      }

      revalidatePath('/')
      redirect(buildRedirectUrl('flavors', { type: 'success', scope: 'flavor-create', message: `Created flavor “${description}”.` }, asText(data?.id)))
    } catch (error) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-create', message: error instanceof Error ? `Could not create flavor: ${error.message}` : 'Could not create flavor.' }))
    }
  }

  async function updateFlavor(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const slug = slugify(String(formData.get('slug') ?? '').trim())

    if (!id || !profile?.id || !description || !slug) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-update', message: 'Update flavor requires an id, description, and valid slug.' }, id))
    }

    try {
      const { error } = await supabase
        .from(TABLES.flavors)
        .update({
          description,
          slug,
          modified_by_user_id: profile.id
        })
        .eq('id', id)

      if (error) {
        redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-update', message: `Could not save flavor changes: ${error.message}` }, id))
      }

      revalidatePath('/')
      redirect(buildRedirectUrl('flavors', { type: 'success', scope: 'flavor-update', message: 'Flavor changes saved.' }, id))
    } catch (error) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-update', message: error instanceof Error ? `Could not save flavor changes: ${error.message}` : 'Could not save flavor changes.' }, id))
    }
  }

  async function deleteFlavor(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    if (!id) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-delete', message: 'Delete flavor requires a valid id.' }))
    }

    try {
      const { error } = await supabase.from(TABLES.flavors).delete().eq('id', id)
      if (error) {
        redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-delete', message: `Could not delete flavor: ${error.message}` }))
      }

      revalidatePath('/')
      redirect(buildRedirectUrl('flavors', { type: 'success', scope: 'flavor-delete', message: 'Flavor deleted.' }))
    } catch (error) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-delete', message: error instanceof Error ? `Could not delete flavor: ${error.message}` : 'Could not delete flavor.' }))
    }
  }

  async function duplicateFlavor(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()

    if (!id || !profile?.id) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-duplicate', message: 'Duplicate flavor requires a valid source flavor.' }, id))
    }

    const sourceFlavor = flavors.find((row) => getFlavorId(row) === id)
    if (!sourceFlavor) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-duplicate', message: 'Source flavor could not be found in the loaded dataset.' }, id))
    }

    const sourceDescription = getFlavorDescription(sourceFlavor)
    const sourceSlug = getFlavorSlug(sourceFlavor)
    const duplicateDescription = sourceDescription ? `${sourceDescription} (Copy)` : `Copy of ${sourceSlug || id}`
    const duplicateSlug = buildDuplicateSlug(flavors.map((row) => getFlavorSlug(row)), sourceSlug, sourceDescription)

    try {
      const { data: insertedFlavor, error: insertFlavorError } = await supabase
        .from(TABLES.flavors)
        .insert({
          description: duplicateDescription,
          slug: duplicateSlug,
          created_by_user_id: profile.id,
          modified_by_user_id: profile.id
        })
        .select('id')
        .single()

      if (insertFlavorError || !insertedFlavor?.id) {
        redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-duplicate', message: `Could not duplicate flavor: ${insertFlavorError?.message ?? 'new flavor row was not created.'}` }, id))
      }

      const relatedSteps = sortSteps(steps.filter((row) => getStepFlavorId(row) === id))
      if (relatedSteps.length) {
        const stepPayloads = relatedSteps.map((step, index) => ({
          humor_flavor_id: insertedFlavor.id,
          llm_temperature: step[stepTemperatureKey] ?? null,
          order_by: getStepOrder(step) === Number.MAX_SAFE_INTEGER ? index + 1 : getStepOrder(step),
          llm_input_type_id: step[stepInputTypeKey] ?? null,
          llm_output_type_id: step[stepOutputTypeKey] ?? null,
          llm_model_id: step[stepModelKey] ?? null,
          humor_flavor_step_type_id: step[stepTitleKey] ?? null,
          llm_system_prompt: step[stepSystemPromptKey] ?? null,
          llm_user_prompt: step[stepUserPromptKey] ?? null,
          description: step[stepBodyKey] ?? null,
          created_by_user_id: profile.id,
          modified_by_user_id: profile.id
        }))

        const { error: insertStepsError } = await supabase.from(TABLES.steps).insert(stepPayloads)

        if (insertStepsError) {
          await supabase.from(TABLES.flavors).delete().eq('id', insertedFlavor.id)
          redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-duplicate', message: `Could not duplicate flavor steps: ${insertStepsError.message}` }, id))
        }
      }

      revalidatePath('/')
      redirect(buildRedirectUrl('flavors', { type: 'success', scope: 'flavor-duplicate', message: `Duplicated flavor as “${duplicateDescription}”.` }, insertedFlavor.id))
    } catch (error) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-duplicate', message: error instanceof Error ? `Could not duplicate flavor: ${error.message}` : 'Could not duplicate flavor.' }, id))
    }
  }

  async function createStep(formData: FormData) {
    'use server'
    const supabase = createClient()
    const flavorId = String(formData.get('flavor_id') ?? '').trim()
    if (!flavorId || !profile?.id) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-create', message: 'Create step requires a selected flavor.' }, flavorId))
    }

    const currentSteps = sortSteps(steps.filter((row) => getStepFlavorId(row) === flavorId))
    const nextOrder = (currentSteps.at(-1) ? getStepOrder(currentSteps.at(-1) as GenericRow) : 0) + 1

    try {
      const { error } = await supabase.from(TABLES.steps).insert({
        humor_flavor_id: flavorId,
        order_by: nextOrder,
        humor_flavor_step_type_id: buildOptionalString(formData.get('step_title')),
        description: buildOptionalString(formData.get('step_body')),
        llm_system_prompt: buildOptionalString(formData.get('system_prompt')),
        llm_user_prompt: buildOptionalString(formData.get('user_prompt')),
        llm_input_type_id: buildOptionalString(formData.get('input_type')),
        llm_output_type_id: buildOptionalString(formData.get('output_type')),
        llm_temperature: asNumber(formData.get('temperature')),
        llm_model_id: buildOptionalString(formData.get('model_link')),
        created_by_user_id: profile.id,
        modified_by_user_id: profile.id
      })

      if (error) {
        redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-create', message: `Could not create step: ${error.message}` }, flavorId))
      }

      revalidatePath('/')
      redirect(buildRedirectUrl('steps', { type: 'success', scope: 'step-create', message: 'Step created.' }, flavorId))
    } catch (error) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-create', message: error instanceof Error ? `Could not create step: ${error.message}` : 'Could not create step.' }, flavorId))
    }
  }

  async function updateStep(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    const returnFlavorId = String(formData.get('return_flavor_id') ?? '').trim()
    if (!id || !profile?.id) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-update', message: 'Update step requires a valid step id.' }, returnFlavorId))
    }

    try {
      const payload: GenericRow = {
        modified_by_user_id: profile.id,
        humor_flavor_step_type_id: buildOptionalString(formData.get('step_title')),
        description: buildOptionalString(formData.get('step_body')),
        llm_system_prompt: buildOptionalString(formData.get('system_prompt')),
        llm_user_prompt: buildOptionalString(formData.get('user_prompt')),
        llm_input_type_id: buildOptionalString(formData.get('input_type')),
        llm_output_type_id: buildOptionalString(formData.get('output_type')),
        llm_temperature: asNumber(formData.get('temperature')),
        llm_model_id: buildOptionalString(formData.get('model_link'))
      }

      const order = asNumber(formData.get('step_order'))
      if (order !== null) payload.order_by = order

      const { error } = await supabase.from(TABLES.steps).update(payload).eq('id', id)
      if (error) {
        redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-update', message: `Could not save step: ${error.message}` }, returnFlavorId))
      }

      revalidatePath('/')
      redirect(buildRedirectUrl('steps', { type: 'success', scope: 'step-update', message: 'Step saved.' }, returnFlavorId))
    } catch (error) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-update', message: error instanceof Error ? `Could not save step: ${error.message}` : 'Could not save step.' }, returnFlavorId))
    }
  }

  async function deleteStep(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    const returnFlavorId = String(formData.get('return_flavor_id') ?? '').trim()
    if (!id) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-delete', message: 'Delete step requires a valid step id.' }, returnFlavorId))
    }

    try {
      const { error } = await supabase.from(TABLES.steps).delete().eq('id', id)
      if (error) {
        redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-delete', message: `Could not delete step: ${error.message}` }, returnFlavorId))
      }

      revalidatePath('/')
      redirect(buildRedirectUrl('steps', { type: 'success', scope: 'step-delete', message: 'Step deleted.' }, returnFlavorId))
    } catch (error) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-delete', message: error instanceof Error ? `Could not delete step: ${error.message}` : 'Could not delete step.' }, returnFlavorId))
    }

  async function reorderStep(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    const direction = String(formData.get('direction') ?? '').trim()
    const returnFlavorId = String(formData.get('return_flavor_id') ?? '').trim()

    if (!id || !profile?.id || !['up', 'down'].includes(direction)) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-reorder', message: 'Move step requires a valid step id and direction.' }, returnFlavorId))
    }

    const target = steps.find((row) => getRowId(row) === id)
    if (!target) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-reorder', message: 'Could not find the selected step to reorder.' }, returnFlavorId))
    }

    try {
      const flavorId = getStepFlavorId(target)
      const siblings = sortSteps(steps.filter((row) => getStepFlavorId(row) === flavorId))
      const currentIndex = siblings.findIndex((row) => getRowId(row) === id)
      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      const reordered = resequenceRows(moveItem(siblings, currentIndex, nextIndex), 'order_by')

      const updates = reordered.map((row) =>
        supabase
          .from(TABLES.steps)
          .update({ order_by: row.order_by, modified_by_user_id: profile.id })
          .eq('id', getRowId(row))
      )

      const results = await Promise.all(updates)
      const error = results.find((result) => result.error)?.error
      if (error) {
        redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-reorder', message: `Could not reorder steps: ${error.message}` }, flavorId || returnFlavorId))
      }

      revalidatePath('/')
      redirect(buildRedirectUrl('steps', { type: 'success', scope: 'step-reorder', message: 'Step order updated.' }, flavorId || returnFlavorId))
    } catch (error) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-reorder', message: error instanceof Error ? `Could not reorder steps: ${error.message}` : 'Could not reorder steps.' }, returnFlavorId))
    }
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
              feedback={feedback}
              flavors={flavors}
              images={images}
              initialSelectedFlavorId={selectedFlavorId}
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
