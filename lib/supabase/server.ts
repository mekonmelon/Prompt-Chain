import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getEnv } from '@/lib/env'
import { resolveCurrentProfileId } from '@/lib/supabase/profile'

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

export { resolveCurrentProfileId }

export async function requireCurrentProfileId(supabase: ReturnType<typeof createClient> = createClient()) {
  const profileId = await resolveCurrentProfileId(supabase)

  if (!profileId) {
    throw new Error('Unable to resolve the authenticated user to public.profiles.id.')
  }

  return profileId
}
