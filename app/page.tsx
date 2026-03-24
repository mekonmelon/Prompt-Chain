import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

function buildRedirectUrl(
  section: string,
  feedback: { type: 'success' | 'error'; scope: string; message: string },
  selectedId?: string
) {
  const params = new URLSearchParams()

  params.set('section', section)
  params.set('feedbackType', feedback.type)
  params.set('feedbackScope', feedback.scope)
  params.set('feedbackMessage', feedback.message)

  if (selectedId) {
    params.set('selectedFlavorId', selectedId)
  }

  return `/?${params.toString()}`
}

import {
  getFlavorId,
  getFlavorSlug,
  getFlavorDescription,
  getStepFlavorId,
  sortSteps,
  buildDuplicateSlug,
  asNumber
} from '@/lib/prompt-chain'

import { PromptChainStudioSection } from '@/components/sections/prompt-chain-studio-section'

const TABLES = {
  flavors: 'humor_flavors',
  steps: 'humor_flavor_steps'
}

export default async function Page() {
  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.is_superadmin && !profile?.is_matrix_admin) {
    redirect('/unauthorized')
  }

  const { data: flavors } = await supabase.from(TABLES.flavors).select('*')
  const { data: steps } = await supabase.from(TABLES.steps).select('*')

  async function createFlavor(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const slug = String(formData.get('slug') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()

    if (!slug) {
      redirect(
        buildRedirectUrl('flavors', {
          type: 'error',
          scope: 'flavor-create',
          message: 'Slug is required.'
        })
      )
    }

    const { error } = await supabase.from(TABLES.flavors).insert({
      slug,
      description: description || null,
      created_by_user_id: profile.id,
      modified_by_user_id: profile.id
    })

    if (error) {
      redirect(
        buildRedirectUrl('flavors', {
          type: 'error',
          scope: 'flavor-create',
          message: error.message
        })
      )
    }

    revalidatePath('/')

    redirect(
      buildRedirectUrl('flavors', {
        type: 'success',
        scope: 'flavor-create',
        message: 'Flavor created.'
      })
    )
  }

  async function updateFlavor(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const id = String(formData.get('id') ?? '')
    const slug = String(formData.get('slug') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()

    if (!id || !slug) {
      redirect(
        buildRedirectUrl('flavors', {
          type: 'error',
          scope: 'flavor-update',
          message: 'Update flavor requires an id and valid slug.'
        })
      )
    }

    const { error } = await supabase
      .from(TABLES.flavors)
      .update({
        slug,
        description: description || null,
        modified_by_user_id: profile.id
      })
      .eq('id', id)

    if (error) {
      redirect(
        buildRedirectUrl('flavors', {
          type: 'error',
          scope: 'flavor-update',
          message: error.message
        })
      )
    }

    revalidatePath('/')

    redirect(
      buildRedirectUrl('flavors', {
        type: 'success',
        scope: 'flavor-update',
        message: 'Flavor updated.'
      })
    )
  }

  async function deleteFlavor(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const id = String(formData.get('id') ?? '')

    if (!id) {
      redirect(
        buildRedirectUrl('flavors', {
          type: 'error',
          scope: 'flavor-delete',
          message: 'Delete requires id.'
        })
      )
    }

    const { error } = await supabase.from(TABLES.flavors).delete().eq('id', id)

    if (error) {
      redirect(
        buildRedirectUrl('flavors', {
          type: 'error',
          scope: 'flavor-delete',
          message: error.message
        })
      )
    }

    revalidatePath('/')

    redirect(
      buildRedirectUrl('flavors', {
        type: 'success',
        scope: 'flavor-delete',
        message: 'Flavor deleted.'
      })
    )
  }

  async function duplicateFlavor(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const id = String(formData.get('id') ?? '')

    const source = flavors.find((f) => getFlavorId(f) === id)

    if (!source) {
      redirect(
        buildRedirectUrl('flavors', {
          type: 'error',
          scope: 'flavor-duplicate',
          message: 'Source not found.'
        })
      )
    }

    const newSlug = buildDuplicateSlug(
      flavors.map((f) => getFlavorSlug(f)),
      getFlavorSlug(source),
      id
    )

    const { data: inserted, error } = await supabase
      .from(TABLES.flavors)
      .insert({
        slug: newSlug,
        description: getFlavorDescription(source),
        created_by_user_id: profile.id,
        modified_by_user_id: profile.id
      })
      .select('id')
      .single()

    if (error) {
      redirect(
        buildRedirectUrl('flavors', {
          type: 'error',
          scope: 'flavor-duplicate',
          message: error.message
        })
      )
    }

    const related = sortSteps(steps.filter((s) => getStepFlavorId(s) === id))

    if (related.length) {
      const payload = related.map((step, i) => ({
        humor_flavor_id: inserted.id,
        order_by: i + 1,
        llm_temperature: asNumber(step.llm_temperature),
        llm_input_type_id: asNumber(step.llm_input_type_id),
        llm_output_type_id: asNumber(step.llm_output_type_id),
        llm_model_id: asNumber(step.llm_model_id),
        humor_flavor_step_type_id: asNumber(step.humor_flavor_step_type_id),
        llm_system_prompt: step.llm_system_prompt,
        llm_user_prompt: step.llm_user_prompt,
        description: step.description,
        created_by_user_id: profile.id,
        modified_by_user_id: profile.id
      }))

      const { error: stepError } = await supabase.from(TABLES.steps).insert(payload)

      if (stepError) {
        await supabase.from(TABLES.flavors).delete().eq('id', inserted.id)

        redirect(
          buildRedirectUrl('flavors', {
            type: 'error',
            scope: 'flavor-duplicate',
            message: stepError.message
          })
        )
      }
    }

    revalidatePath('/')

    redirect(
      buildRedirectUrl('flavors', {
        type: 'success',
        scope: 'flavor-duplicate',
        message: 'Flavor duplicated.'
      })
    )
  }

  return (
    <PromptChainStudioSection
      flavors={flavors ?? []}
      steps={steps ?? []}
      createFlavor={createFlavor}
      updateFlavor={updateFlavor}
      deleteFlavor={deleteFlavor}
      duplicateFlavor={duplicateFlavor}
    />
  )
}
