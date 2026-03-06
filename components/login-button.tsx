'use client'

import { createClient } from '@/lib/supabase/browser'

export function LoginButton() {
  const signInWithGoogle = async () => {
    const supabase = createClient()
    const origin = window.location.origin
    
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    })
  }

  return (
    <button 
      className="rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
      onClick={signInWithGoogle}
    >
      Continue with Google
    </button>
  )
}
