import type { SupabaseClient } from '@supabase/supabase-js'

type SupabaseProfileClient = Pick<SupabaseClient<any, 'public', any>, 'auth' | 'from'>

export async function tryResolveProfileIdByColumn(supabase: SupabaseProfileClient, column: string, value: string) {
  const { data, error } = await supabase.from('profiles').select('id').eq(column, value).maybeSingle()

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('column') || message.includes('schema cache')) {
      return null
    }
    throw new Error(`Failed resolving profiles.id via ${column}: ${error.message}`)
  }

  return (data as { id?: string } | null)?.id ?? null
}

export async function resolveCurrentProfileId(supabase: SupabaseProfileClient) {
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

export async function fetchCurrentProfile<TProfile extends Record<string, unknown> = Record<string, unknown>>(
  supabase: SupabaseProfileClient,
  columns = '*'
) {
  const profileId = await resolveCurrentProfileId(supabase)
  if (!profileId) return null

  const { data, error } = await supabase.from('profiles').select(columns).eq('id', profileId).maybeSingle()
  if (error) {
    throw new Error(`Failed fetching current profile: ${error.message}`)
  }

  return (data as TProfile | null) ?? null
}
