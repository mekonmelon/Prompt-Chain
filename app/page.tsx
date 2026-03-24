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

function buildOptionalInteger(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  if (!text) return { value: null, error: null }
  if (!/^-?\d+$/.test(text)) {
    return { value: null, error: `Expected an integer value but received "${text}".` }
  }
  const parsed = Number(text)
  if (!Number.isSafeInteger(parsed)) {
    return { value: null, error: `Integer value "${text}" is outside the supported range.` }
  }
  return { value: parsed, error: null }
}

function buildOptionalFloat(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  if (!text) return { value: null, error: null }
  const parsed = Number(text)
  if (!Number.isFinite(parsed)) {
    return { value: null, error: `Expected a numeric value but received "${text}".` }
  }
  return { value: parsed, error: null }
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
  const stepFlavorKey = pickFirstKey(steps, FLAVOR_RELATION_KEYS) ?? 'flavor_id'
  const stepOrderKey = pickFirstKey(steps, STEP_ORDER_KEYS) ?? 'step_order'

  async function createFlavor(formData: FormData) {
    'use server'
    const supabase = createClient()
    const rawSlug = String(formData.get('slug') ?? '').trim()
    const slug = rawSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    const description = String(formData.get('description') ?? '').trim()

    if (!profile?.id) {
      console.error('[studio.action] create flavor validation failed: missing authorized profile')
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-create', message: 'You must be signed in as an authorized profile to create a flavor.' }))
    }

    if (!slug) {
      console.error('[studio.action] create flavor validation failed', { rawSlug })
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-create', message: 'Create flavor requires a valid slug.' }))
    }

    let insertedId = ''
    let actionError: string | null = null

    try {
      const payload: GenericRow = {
        slug,
        description: description || null,
        created_by_user_id: profile.id,
        modified_by_user_id: profile.id
      }

      const { data, error } = await supabase
        .from(TABLES.flavors)
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        console.error('[studio.action] create flavor db error', { message: error.message, code: error.code })
        actionError = `Could not create flavor: ${error.message}`
      } else {
        insertedId = asText(data?.id)
        console.info('[studio.action] create flavor success', { flavorId: insertedId, profileId: profile.id })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[studio.action] create flavor unexpected exception', { message })
      actionError = `Could not create flavor: ${message}`
    }

    if (actionError) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-create', message: actionError }))
    }

    revalidatePath('/')
    redirect(buildRedirectUrl('flavors', { type: 'success', scope: 'flavor-create', message: `Created flavor “${slug}”.` }, insertedId))
  }

  async function updateFlavor(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    const rawSlug = String(formData.get('slug') ?? '').trim()
    const slug = rawSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    const description = String(formData.get('description') ?? '').trim()

    if (!id || !profile?.id || !slug) {
      console.error('[studio.action] update flavor validation failed', { id, hasProfile: Boolean(profile?.id), rawSlug })
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-update', message: 'Update flavor requires an id and valid slug.' }, id))
    }

    let actionError: string | null = null

    try {
      const payload: GenericRow = {
        slug,
        description: description || null,
        modified_by_user_id: profile.id
      }

      const { error } = await supabase
        .from(TABLES.flavors)
        .update(payload)
        .eq('id', id)

      if (error) {
        console.error('[studio.action] update flavor db error', { flavorId: id, message: error.message, code: error.code })
        actionError = `Could not save flavor changes: ${error.message}`
      } else {
        console.info('[studio.action] update flavor success', { flavorId: id, profileId: profile.id })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[studio.action] update flavor unexpected exception', { flavorId: id, message })
      actionError = `Could not save flavor changes: ${message}`
    }

    if (actionError) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-update', message: actionError }, id))
    }

    revalidatePath('/')
    redirect(buildRedirectUrl('flavors', { type: 'success', scope: 'flavor-update', message: 'Flavor changes saved.' }, id))
  }

  async function deleteFlavor(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    if (!id) {
      console.error('[studio.action] delete flavor validation failed: missing flavor id')
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-delete', message: 'Delete flavor requires a valid id.' }))
    }

    let actionError: string | null = null
    try {
      const { error } = await supabase.from(TABLES.flavors).delete().eq('id', id)
      if (error) {
        console.error('[studio.action] delete flavor db error', { flavorId: id, message: error.message, code: error.code })
        actionError = `Could not delete flavor: ${error.message}`
      } else {
        console.info('[studio.action] delete flavor success', { flavorId: id, profileId: profile?.id ?? null })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[studio.action] delete flavor unexpected exception', { flavorId: id, message })
      actionError = `Could not delete flavor: ${message}`
    }

    if (actionError) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-delete', message: actionError }))
    }

    revalidatePath('/')
    redirect(buildRedirectUrl('flavors', { type: 'success', scope: 'flavor-delete', message: 'Flavor deleted.' }))
  }

  async function duplicateFlavor(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()

    if (!id || !profile?.id) {
      console.error('[studio.action] duplicate flavor validation failed', { id, hasProfile: Boolean(profile?.id) })
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-duplicate', message: 'Duplicate flavor requires a valid source flavor.' }, id))
    }

    const sourceFlavor = flavors.find((row) => getFlavorId(row) === id)
    if (!sourceFlavor) {
      console.error('[studio.action] duplicate flavor validation failed: source flavor missing from loaded rows', { flavorId: id })
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-duplicate', message: 'Source flavor could not be found in the loaded dataset.' }, id))
    }

    const sourceDescription = getFlavorDescription(sourceFlavor)
    const sourceSlug = getFlavorSlug(sourceFlavor)
    const duplicateDescription = sourceDescription ? `${sourceDescription} (Copy)` : null
    const duplicateSlug = buildDuplicateSlug(flavors.map((row) => getFlavorSlug(row)), sourceSlug, sourceDescription || id)
    let insertedFlavorId = ''
    let actionError: string | null = null

    try {
      const flavorPayload: GenericRow = {
        slug: duplicateSlug,
        description: duplicateDescription,
        created_by_user_id: profile.id,
        modified_by_user_id: profile.id
      }

      const { data: insertedFlavor, error: insertFlavorError } = await supabase
        .from(TABLES.flavors)
        .insert(flavorPayload)
        .select('id')
        .single()

      if (insertFlavorError || !insertedFlavor?.id) {
        console.error('[studio.action] duplicate flavor db error while inserting flavor', { sourceFlavorId: id, message: insertFlavorError?.message ?? 'missing inserted id', code: insertFlavorError?.code ?? null })
        actionError = `Could not duplicate flavor: ${insertFlavorError?.message ?? 'new flavor row was not created.'}`
      } else {
        insertedFlavorId = asText(insertedFlavor.id)
        const relatedSteps = sortSteps(steps.filter((row) => getStepFlavorId(row) === id))
        if (relatedSteps.length) {
          const stepPayloads = relatedSteps.map((step, index) => ({
            [stepFlavorKey]: insertedFlavorId,
            [stepTemperatureKey]: asNumber(step[stepTemperatureKey]),
            [stepOrderKey]: getStepOrder(step) === Number.MAX_SAFE_INTEGER ? index + 1 : getStepOrder(step),
            [stepInputTypeKey]: asNumber(step[stepInputTypeKey]),
            [stepOutputTypeKey]: asNumber(step[stepOutputTypeKey]),
            [stepModelKey]: asNumber(step[stepModelKey]),
            [stepTitleKey]: asNumber(step[stepTitleKey]),
            [stepSystemPromptKey]: step[stepSystemPromptKey] ?? null,
            [stepUserPromptKey]: step[stepUserPromptKey] ?? null,
            [stepBodyKey]: step[stepBodyKey] ?? null,
            created_by_user_id: profile.id,
            modified_by_user_id: profile.id
          }))

          const { error: insertStepsError } = await supabase.from(TABLES.steps).insert(stepPayloads)

          if (insertStepsError) {
            console.error('[studio.action] duplicate flavor db error while inserting steps', { sourceFlavorId: id, newFlavorId: insertedFlavorId, message: insertStepsError.message, code: insertStepsError.code })
            await supabase.from(TABLES.flavors).delete().eq('id', insertedFlavorId)
            actionError = `Could not duplicate flavor steps: ${insertStepsError.message}`
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[studio.action] duplicate flavor unexpected exception', { sourceFlavorId: id, message })
      actionError = `Could not duplicate flavor: ${message}`
    }

    if (actionError) {
      redirect(buildRedirectUrl('flavors', { type: 'error', scope: 'flavor-duplicate', message: actionError }, id))
    }

    console.info('[studio.action] duplicate flavor success', { sourceFlavorId: id, newFlavorId: insertedFlavorId, profileId: profile.id })
    revalidatePath('/')
    redirect(buildRedirectUrl('flavors', { type: 'success', scope: 'flavor-duplicate', message: `Duplicated flavor as “${duplicateSlug}”.` }, insertedFlavorId))
  }

  async function createStep(formData: FormData) {
    'use server'
    const supabase = createClient()
    const flavorId = String(formData.get('flavor_id') ?? '').trim()
    if (!flavorId || !profile?.id) {
      console.error('[studio.action] create step validation failed', { flavorId, hasProfile: Boolean(profile?.id) })
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-create', message: 'Create step requires a selected flavor.' }, flavorId))
    }

    const currentSteps = sortSteps(steps.filter((row) => getStepFlavorId(row) === flavorId))
    const nextOrder = (currentSteps.at(-1) ? getStepOrder(currentSteps.at(-1) as GenericRow) : 0) + 1
    const inputType = buildOptionalInteger(formData.get('input_type'))
    const outputType = buildOptionalInteger(formData.get('output_type'))
    const modelId = buildOptionalInteger(formData.get('model_link'))
    const stepType = buildOptionalInteger(formData.get('step_title'))
    const temperature = buildOptionalFloat(formData.get('temperature'))

    const validationErrors = [inputType.error, outputType.error, modelId.error, stepType.error, temperature.error].filter(Boolean)
    if (validationErrors.length) {
      console.error('[studio.action] create step validation failed', { flavorId, issues: validationErrors })
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-create', message: validationErrors.join(' ') }, flavorId))
    }

    let actionError: string | null = null

    try {
      const { error } = await supabase.from(TABLES.steps).insert({
        [stepFlavorKey]: flavorId,
        [stepOrderKey]: nextOrder,
        [stepTitleKey]: stepType.value,
        [stepBodyKey]: buildOptionalString(formData.get('step_body')),
        [stepSystemPromptKey]: buildOptionalString(formData.get('system_prompt')),
        [stepUserPromptKey]: buildOptionalString(formData.get('user_prompt')),
        [stepInputTypeKey]: inputType.value,
        [stepOutputTypeKey]: outputType.value,
        [stepTemperatureKey]: temperature.value,
        [stepModelKey]: modelId.value,
        created_by_user_id: profile.id,
        modified_by_user_id: profile.id
      })

      if (error) {
        console.error('[studio.action] create step db error', { flavorId, message: error.message, code: error.code })
        actionError = `Could not create step: ${error.message}`
      } else {
        console.info('[studio.action] create step success', { flavorId, profileId: profile.id })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[studio.action] create step unexpected exception', { flavorId, message })
      actionError = `Could not create step: ${message}`
    }

    if (actionError) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-create', message: actionError }, flavorId))
    }

    revalidatePath('/')
    redirect(buildRedirectUrl('steps', { type: 'success', scope: 'step-create', message: 'Step created.' }, flavorId))
  }

  async function updateStep(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    const returnFlavorId = String(formData.get('return_flavor_id') ?? '').trim()
    if (!id || !profile?.id) {
      console.error('[studio.action] update step validation failed', { stepId: id, returnFlavorId, hasProfile: Boolean(profile?.id) })
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-update', message: 'Update step requires a valid step id.' }, returnFlavorId))
    }

    const inputType = buildOptionalInteger(formData.get('input_type'))
    const outputType = buildOptionalInteger(formData.get('output_type'))
    const modelId = buildOptionalInteger(formData.get('model_link'))
    const stepType = buildOptionalInteger(formData.get('step_title'))
    const order = buildOptionalInteger(formData.get('step_order'))
    const temperature = buildOptionalFloat(formData.get('temperature'))
    const validationErrors = [inputType.error, outputType.error, modelId.error, stepType.error, order.error, temperature.error].filter(Boolean)
    if (validationErrors.length) {
      console.error('[studio.action] update step validation failed', { stepId: id, returnFlavorId, issues: validationErrors })
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-update', message: validationErrors.join(' ') }, returnFlavorId))
    }

    let actionError: string | null = null
    try {
      const payload: GenericRow = {
        modified_by_user_id: profile.id,
        [stepTitleKey]: stepType.value,
        [stepBodyKey]: buildOptionalString(formData.get('step_body')),
        [stepSystemPromptKey]: buildOptionalString(formData.get('system_prompt')),
        [stepUserPromptKey]: buildOptionalString(formData.get('user_prompt')),
        [stepInputTypeKey]: inputType.value,
        [stepOutputTypeKey]: outputType.value,
        [stepTemperatureKey]: temperature.value,
        [stepModelKey]: modelId.value
      }

      if (order.value !== null) payload[stepOrderKey] = order.value

      const { error } = await supabase.from(TABLES.steps).update(payload).eq('id', id)
      if (error) {
        console.error('[studio.action] update step db error', { stepId: id, returnFlavorId, message: error.message, code: error.code })
        actionError = `Could not save step: ${error.message}`
      } else {
        console.info('[studio.action] update step success', { stepId: id, returnFlavorId, profileId: profile.id })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[studio.action] update step unexpected exception', { stepId: id, returnFlavorId, message })
      actionError = `Could not save step: ${message}`
    }

    if (actionError) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-update', message: actionError }, returnFlavorId))
    }

    revalidatePath('/')
    redirect(buildRedirectUrl('steps', { type: 'success', scope: 'step-update', message: 'Step saved.' }, returnFlavorId))
  }

  async function deleteStep(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    const returnFlavorId = String(formData.get('return_flavor_id') ?? '').trim()
    if (!id) {
      console.error('[studio.action] delete step validation failed', { returnFlavorId })
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-delete', message: 'Delete step requires a valid step id.' }, returnFlavorId))
    }

    let actionError: string | null = null
    try {
      const { error } = await supabase.from(TABLES.steps).delete().eq('id', id)
      if (error) {
        console.error('[studio.action] delete step db error', { stepId: id, returnFlavorId, message: error.message, code: error.code })
        actionError = `Could not delete step: ${error.message}`
      } else {
        console.info('[studio.action] delete step success', { stepId: id, returnFlavorId, profileId: profile?.id ?? null })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[studio.action] delete step unexpected exception', { stepId: id, returnFlavorId, message })
      actionError = `Could not delete step: ${message}`
    }

    if (actionError) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-delete', message: actionError }, returnFlavorId))
    }

    revalidatePath('/')
    redirect(buildRedirectUrl('steps', { type: 'success', scope: 'step-delete', message: 'Step deleted.' }, returnFlavorId))
  }

  async function reorderStep(formData: FormData) {
    'use server'
    const supabase = createClient()
    const id = String(formData.get('id') ?? '').trim()
    const direction = String(formData.get('direction') ?? '').trim()
    const returnFlavorId = String(formData.get('return_flavor_id') ?? '').trim()

    if (!id || !profile?.id || !['up', 'down'].includes(direction)) {
      console.error('[studio.action] reorder step validation failed', { stepId: id, direction, returnFlavorId, hasProfile: Boolean(profile?.id) })
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-reorder', message: 'Move step requires a valid step id and direction.' }, returnFlavorId))
    }

    const target = steps.find((row) => getRowId(row) === id)
    if (!target) {
      console.error('[studio.action] reorder step validation failed: step missing in loaded rows', { stepId: id, returnFlavorId })
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-reorder', message: 'Could not find the selected step to reorder.' }, returnFlavorId))
    }

    let actionError: string | null = null
    let redirectFlavorId = returnFlavorId
    try {
      const flavorId = getStepFlavorId(target)
      redirectFlavorId = flavorId || returnFlavorId
      const siblings = sortSteps(steps.filter((row) => getStepFlavorId(row) === flavorId))
      const currentIndex = siblings.findIndex((row) => getRowId(row) === id)
      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      const reordered = resequenceRows(moveItem(siblings, currentIndex, nextIndex), stepOrderKey)

      const updates = reordered.map((row) =>
        supabase
          .from(TABLES.steps)
          .update({ [stepOrderKey]: row[stepOrderKey], modified_by_user_id: profile.id })
          .eq('id', getRowId(row))
      )

      const results = await Promise.all(updates)
      const error = results.find((result) => result.error)?.error
      if (error) {
        console.error('[studio.action] reorder step db error', { stepId: id, direction, flavorId: redirectFlavorId, message: error.message, code: error.code })
        actionError = `Could not reorder steps: ${error.message}`
      } else {
        console.info('[studio.action] reorder step success', { stepId: id, direction, flavorId: redirectFlavorId, profileId: profile.id })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[studio.action] reorder step unexpected exception', { stepId: id, direction, returnFlavorId, message })
      actionError = `Could not reorder steps: ${message}`
    }

    if (actionError) {
      redirect(buildRedirectUrl('steps', { type: 'error', scope: 'step-reorder', message: actionError }, redirectFlavorId))
    }

    revalidatePath('/')
    redirect(buildRedirectUrl('steps', { type: 'success', scope: 'step-reorder', message: 'Step order updated.' }, redirectFlavorId))
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
