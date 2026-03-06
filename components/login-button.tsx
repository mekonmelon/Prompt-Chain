'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

export function LoginButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const signInWithGoogle = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const supabase = createClient()
      const origin = window.location.origin

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`
        }
      })

      if (error) {
        setErrorMessage(error.message)
        return
      }

      if (!data?.url) {
        setErrorMessage('Unable to start Google login. Check your Supabase provider configuration.')
        return
      }

      window.location.assign(data.url)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unexpected login error.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid gap-3">
      <button
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white shadow hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-500"
        disabled={isLoading}
        onClick={signInWithGoogle}
        type="button"
      >
        {isLoading ? 'Redirecting…' : 'Continue with Google'}
      </button>

      {errorMessage ? (
        <p className="max-w-lg rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</p>
      ) : null}
    </div>
  )
}
