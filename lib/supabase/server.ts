import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getEnv } from '@/lib/env'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: Record<string, unknown>) {
        cookieStore.set({ name, value: '', ...options })
      }
    }
  })
}

async function tryResolveProfileIdByColumn(
  supabase: ReturnType<typeof createClient>,
  column: string,
  value: string
) {
  const { data, error } = await supabase.from('profiles').select('id').eq(column, value).maybeSingle()

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('column') || message.includes('schema cache')) {
      return null
    }
    throw new Error(`Failed resolving profiles.id via ${column}: ${error.message}`)
  }

  return data?.id ?? null
}

export async function resolveCurrentProfileId(supabase: ReturnType<typeof createClient> = createClient()) {
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const candidateMatches: Array<[string, string | undefined]> = [
    ['id', user.id],
    ['auth_user_id', user.id],
    ['user_id', user.id],
    ['email', user.email]
  ]

  for (const [column, value] of candidateMatches) {
    if (!value) continue
    const profileId = await tryResolveProfileIdByColumn(supabase, column, value)
    if (profileId) return profileId
  }

  return null
}

export async function requireCurrentProfileId(supabase: ReturnType<typeof createClient> = createClient()) {
  const profileId = await resolveCurrentProfileId(supabase)

  if (!profileId) {
    throw new Error('Unable to resolve the authenticated user to public.profiles.id.')
  }

  return profileId
}
