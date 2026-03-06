import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  return (
    <main>
      <h1>The Humor Project Admin</h1>
      <p>Welcome{user?.email ? `, ${user.email}` : ''}.</p>
      <p>All routes are protected by Google authentication + superadmin check.</p>
    </main>
  )
}
