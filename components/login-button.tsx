'use client'

import { createClient } from '@/lib/supabase/browser'

export function LoginButton() {
  const signInWithGoogle = async () => {
    const supabase = createClient()
    const origin = window.location.origin

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`
      }
    })
  }

  return (
    <button style={{ background: '#111', color: '#fff' }} onClick={signInWithGoogle}>
      Continue with Google
    </button>
  )
}
