import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type ProfileRow = {
  id: string
  email: string | null
  is_superadmin: boolean | null
  created_at: string | null
}

type ImageRow = {
  id: string
  url: string | null
  description: string | null
  user_id: string | null
  created_at: string | null
}

type CaptionRow = {
  id: string
  image_id: string | null
  author_id: string | null
  content: string | null
  created_at: string | null
}

type CaptionVoteRow = {
  caption_id: string | null
}

async function createImage(formData: FormData) {
  'use server'
  const supabase = createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const url = String(formData.get('url') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!url) return

  await supabase.from('images').insert({
    url,
    description,
    user_id: user.id
  })

  revalidatePath('/')
}

async function updateImageDescription(formData: FormData) {
  'use server'
  const supabase = createClient()
  const id = String(formData.get('id') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!id) return

  await supabase.from('images').update({ description }).eq('id', id)
  revalidatePath('/')
}

async function deleteImage(formData: FormData) {
  'use server'
  const supabase = createClient()
  const id = String(formData.get('id') ?? '').trim()

  if (!id) return

  await supabase.from('images').delete().eq('id', id)
  revalidatePath('/')
}

async function signOut() {
  'use server'
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function Home() {
  const supabase = createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const [{ data: profiles }, { data: images }, { data: captions }, { data: captionVotes }] = await Promise.all([
    supabase.from('profiles').select('id,email,is_superadmin,created_at').order('created_at', { ascending: false }),
    supabase.from('images').select('id,url,description,user_id,created_at').order('created_at', { ascending: false }),
    supabase.from('captions').select('id,image_id,author_id,content,created_at').order('created_at', { ascending: false }),
    supabase.from('caption_votes').select('caption_id')
  ])

  const profileRows = (profiles ?? []) as ProfileRow[]
  const imageRows = (images ?? []) as ImageRow[]
  const captionRows = (captions ?? []) as CaptionRow[]
  const voteRows = (captionVotes ?? []) as CaptionVoteRow[]

  const totalUsers = profileRows.length
  const totalImages = imageRows.length
  const averageCaptionsPerImage = totalImages > 0 ? captionRows.length / totalImages : 0

  const voteCountByCaptionId = voteRows.reduce<Record<string, number>>((acc, vote) => {
    if (!vote.caption_id) return acc
    acc[vote.caption_id] = (acc[vote.caption_id] ?? 0) + 1
    return acc
  }, {})

  const topCaptions = captionRows
    .map((caption) => ({
      ...caption,
      votes: voteCountByCaptionId[caption.id] ?? 0
    }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5)

  return (
    <main className="mx-auto my-8 w-[95%] max-w-7xl rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-xl backdrop-blur-sm">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-violet-600">The Humor Project</p>
          <h1 className="text-3xl font-bold text-slate-900">Admin Statistics Dashboard</h1>
          <p className="text-slate-600">Signed in as {user?.email ?? 'Unknown user'}.</p>
        </div>
        <form action={signOut}>
          <button className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white shadow-lg">
          <p className="text-sm uppercase tracking-wide text-indigo-100">Total Users</p>
          <p className="mt-2 text-4xl font-bold">{totalUsers}</p>
        </article>
        <article className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 p-5 text-white shadow-lg">
          <p className="text-sm uppercase tracking-wide text-cyan-100">Total Images</p>
          <p className="mt-2 text-4xl font-bold">{totalImages}</p>
        </article>
        <article className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white shadow-lg">
          <p className="text-sm uppercase tracking-wide text-emerald-100">Avg Captions / Image</p>
          <p className="mt-2 text-4xl font-bold">{averageCaptionsPerImage.toFixed(2)}</p>
        </article>
      </section>

      <section className="mb-10 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-xl font-semibold text-amber-900">Top 5 Most Upvoted Captions</h2>
        <p className="mb-4 text-sm text-amber-800">Ranked by vote count from the caption_votes table.</p>
        <div className="grid gap-3">
          {topCaptions.length === 0 ? (
            <p className="rounded-lg bg-white p-3 text-slate-600">No caption votes found yet.</p>
          ) : (
            topCaptions.map((caption, index) => (
              <article key={caption.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-white p-4 shadow-sm">
                <div>
                  <p className="font-semibold text-slate-800">
                    #{index + 1} · Caption ID: {caption.id}
                  </p>
                  <p className="mt-1 text-slate-700">{caption.content ?? '(empty caption)'}</p>
                  <p className="mt-1 text-xs text-slate-500">Image: {caption.image_id ?? 'n/a'}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">{caption.votes} votes</span>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">Users (profiles)</h2>
        <p className="mb-3 text-slate-600">Read-only view of all rows in the profiles table.</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full bg-white text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Is Superadmin</th>
                <th className="px-3 py-2">Created At</th>
              </tr>
            </thead>
            <tbody>
              {profileRows.map((profile) => (
                <tr key={profile.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">{profile.id}</td>
                  <td className="px-3 py-2">{profile.email ?? ''}</td>
                  <td className="px-3 py-2">{profile.is_superadmin ? 'true' : 'false'}</td>
                  <td className="px-3 py-2">{profile.created_at ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">Images</h2>
        <p className="mb-3 text-slate-600">View all images, add a new image URL, edit descriptions, and delete images.</p>

        <form action={createImage} className="mb-5 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input
            className="rounded-md border border-slate-300 bg-white px-3 py-2"
            name="url"
            placeholder="https://example.com/image.jpg"
            required
          />
          <textarea
            className="rounded-md border border-slate-300 bg-white px-3 py-2"
            name="description"
            placeholder="Image description"
            rows={3}
          />
          <button className="w-fit rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700" type="submit">
            Upload New Image
          </button>
        </form>

        <div className="grid gap-3">
          {imageRows.map((image) => (
            <article key={image.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Image ID: {image.id}</p>
              <p className="text-sm text-slate-500">Owner: {image.user_id ?? 'n/a'}</p>
              <p className="mt-1">
                URL:{' '}
                <a className="font-medium text-blue-700 underline" href={image.url ?? ''} rel="noreferrer" target="_blank">
                  {image.url ?? ''}
                </a>
              </p>

              <form action={updateImageDescription} className="mt-3 grid gap-2">
                <input name="id" type="hidden" value={image.id} />
                <textarea
                  className="rounded-md border border-slate-300 bg-white px-3 py-2"
                  defaultValue={image.description ?? ''}
                  name="description"
                  rows={3}
                />
                <button className="w-fit rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700" type="submit">
                  Save Description
                </button>
              </form>

              <form action={deleteImage} className="mt-3">
                <input name="id" type="hidden" value={image.id} />
                <button className="rounded-lg bg-rose-700 px-4 py-2 font-semibold text-white hover:bg-rose-800" type="submit">
                  Delete Image
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold">Captions</h2>
        <p className="mb-3 text-slate-600">Read-only list of all captions in the captions table.</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full bg-white text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Image ID</th>
                <th className="px-3 py-2">Author ID</th>
                <th className="px-3 py-2">Content</th>
                <th className="px-3 py-2">Created At</th>
              </tr>
            </thead>
            <tbody>
              {captionRows.map((caption) => (
                <tr key={caption.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">{caption.id}</td>
                  <td className="px-3 py-2">{caption.image_id ?? ''}</td>
                  <td className="px-3 py-2">{caption.author_id ?? ''}</td>
                  <td className="px-3 py-2">{caption.content ?? ''}</td>
                  <td className="px-3 py-2">{caption.created_at ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
