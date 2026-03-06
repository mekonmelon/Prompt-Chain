import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type GenericRow = Record<string, unknown>

function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function getValue(row: GenericRow, keys: string[]): unknown {
  for (const key of keys) {
    if (key in row) return row[key]
  }
  return undefined
}

function tableColumns(rows: GenericRow[], preferred: string[]) {
  const discovered = new Set<string>()
  for (const row of rows) {
    Object.keys(row).forEach((key) => discovered.add(key))
  }

  const inPreferred = preferred.filter((key) => discovered.has(key))
  const remaining = [...discovered].filter((key) => !inPreferred.includes(key)).sort((a, b) => a.localeCompare(b))

  return [...inPreferred, ...remaining]
}

async function createImage(formData: FormData) {
  'use server'
  const supabase = createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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

  const [profilesRes, imagesRes, captionsRes, votesRes] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('images').select('*'),
    supabase.from('captions').select('*'),
    supabase.from('caption_votes').select('*')
  ])

  const profileRows = (profilesRes.data ?? []) as GenericRow[]
  const imageRows = (imagesRes.data ?? []) as GenericRow[]
  const captionRows = (captionsRes.data ?? []) as GenericRow[]
  const voteRows = (votesRes.data ?? []) as GenericRow[]

  const totalUsers = profileRows.length
  const totalImages = imageRows.length
  const averageCaptionsPerImage = totalImages > 0 ? captionRows.length / totalImages : 0

  const voteCountByCaptionId = voteRows.reduce<Record<string, number>>((acc, vote) => {
    const captionId = asText(getValue(vote, ['caption_id', 'captionId', 'captionid']))
    if (!captionId) return acc
    acc[captionId] = (acc[captionId] ?? 0) + 1
    return acc
  }, {})

  const topCaptions = captionRows
    .map((caption) => {
      const captionId = asText(getValue(caption, ['id', 'caption_id', 'captionId']))
      const content = asText(getValue(caption, ['content', 'caption', 'text', 'body']))
      const imageId = asText(getValue(caption, ['image_id', 'imageId']))
      return {
        captionId,
        content,
        imageId,
        votes: voteCountByCaptionId[captionId] ?? 0
      }
    })
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5)

  const profileColumns = tableColumns(profileRows, ['id', 'email', 'is_superadmin', 'created_at'])
  const imageColumns = tableColumns(imageRows, ['id', 'url', 'description', 'user_id', 'created_at'])
  const captionColumns = tableColumns(captionRows, ['id', 'image_id', 'author_id', 'content', 'created_at'])

  const errors = [
    profilesRes.error && `profiles: ${profilesRes.error.message}`,
    imagesRes.error && `images: ${imagesRes.error.message}`,
    captionsRes.error && `captions: ${captionsRes.error.message}`,
    votesRes.error && `caption_votes: ${votesRes.error.message}`
  ].filter(Boolean) as string[]

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

      {errors.length > 0 && (
        <section className="mb-6 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800">
          <h2 className="text-lg font-semibold">Query diagnostics</h2>
          <p className="mb-2 text-sm">Some dashboard queries failed. This is usually a schema mismatch or RLS issue.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      )}

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
              <article
                key={`${caption.captionId}-${index}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-slate-800">
                    #{index + 1} · Caption ID: {caption.captionId || 'n/a'}
                  </p>
                  <p className="mt-1 text-slate-700">{caption.content || '(empty caption)'}</p>
                  <p className="mt-1 text-xs text-slate-500">Image: {caption.imageId || 'n/a'}</p>
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
                {profileColumns.map((column) => (
                  <th key={column} className="px-3 py-2">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profileRows.map((profile, index) => (
                <tr key={asText(profile.id) || index} className="border-t border-slate-200">
                  {profileColumns.map((column) => (
                    <td key={`${asText(profile.id)}-${column}`} className="max-w-[350px] px-3 py-2 align-top">
                      <div className="truncate" title={asText(profile[column])}>
                        {asText(profile[column])}
                      </div>
                    </td>
                  ))}
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

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full bg-white text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                {imageColumns.map((column) => (
                  <th key={column} className="px-3 py-2">
                    {column}
                  </th>
                ))}
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {imageRows.map((image, index) => {
                const imageId = asText(getValue(image, ['id']))
                const description = asText(getValue(image, ['description']))

                return (
                  <tr key={imageId || index} className="border-t border-slate-200 align-top">
                    {imageColumns.map((column) => (
                      <td key={`${imageId}-${column}`} className="max-w-[300px] px-3 py-2">
                        <div className="truncate" title={asText(image[column])}>
                          {column === 'url' ? (
                            <a className="text-blue-700 underline" href={asText(image[column])} rel="noreferrer" target="_blank">
                              {asText(image[column])}
                            </a>
                          ) : (
                            asText(image[column])
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <form action={updateImageDescription} className="mb-2 grid gap-2">
                        <input name="id" type="hidden" value={imageId} />
                        <textarea
                          className="rounded-md border border-slate-300 bg-white px-2 py-1"
                          defaultValue={description}
                          name="description"
                          rows={2}
                        />
                        <button className="w-fit rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700" type="submit">
                          Save
                        </button>
                      </form>

                      <form action={deleteImage}>
                        <input name="id" type="hidden" value={imageId} />
                        <button className="rounded bg-rose-700 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-800" type="submit">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold">Captions</h2>
        <p className="mb-3 text-slate-600">Read-only list of all captions in the captions table.</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full bg-white text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                {captionColumns.map((column) => (
                  <th key={column} className="px-3 py-2">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {captionRows.map((caption, index) => (
                <tr key={asText(caption.id) || index} className="border-t border-slate-200">
                  {captionColumns.map((column) => (
                    <td key={`${asText(caption.id)}-${column}`} className="max-w-[350px] px-3 py-2 align-top">
                      <div className="truncate" title={asText(caption[column])}>
                        {asText(caption[column])}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
