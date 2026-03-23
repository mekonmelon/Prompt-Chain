export async function tryResolveProfileIdByColumn(
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { id?: string } | null; error: { message: string } | null }> }
      }
    }
  },
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

export async function resolveCurrentProfileId(
  supabase: {
    auth: { getUser: () => Promise<{ data: { user: { id: string; email?: string | undefined } | null } }> }
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { id?: string } | null; error: { message: string } | null }> }
      }
    }
  }
) {
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

export async function fetchCurrentProfile(
  supabase: {
    auth: { getUser: () => Promise<{ data: { user: { id: string; email?: string | undefined } | null } }> }
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> }
      }
    }
  },
  columns = '*'
) {
  const profileId = await resolveCurrentProfileId(supabase)
  if (!profileId) return null

  const { data, error } = await supabase.from('profiles').select(columns).eq('id', profileId).maybeSingle()
  if (error) {
    throw new Error(`Failed fetching current profile: ${error.message}`)
  }

  return data
}
