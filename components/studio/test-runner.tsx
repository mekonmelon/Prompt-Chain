'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'

type FlavorOption = {
  id: string
  name: string
}

type ImageOption = {
  id: string
  label: string
  previewUrl: string
}

type TestResult = {
  captions?: Array<{ content?: string; text?: string; caption?: string; image_url?: string }>
  error?: string
  raw?: unknown
}

export function TestRunner({
  flavors,
  images,
  selectedFlavorId
}: {
  flavors: FlavorOption[]
  images: ImageOption[]
  selectedFlavorId: string
}) {
  const [flavorId, setFlavorId] = useState(selectedFlavorId || flavors[0]?.id || '')
  const [imageId, setImageId] = useState(images[0]?.id || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TestResult | null>(null)

  const selectedImage = useMemo(() => images.find((image) => image.id === imageId) ?? null, [images, imageId])

  const runTest = async () => {
    setIsLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/test-flavor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flavorId,
          imageId,
          imageUrl: selectedImage?.previewUrl || ''
        })
      })

      const payload = await response.json()
      if (!response.ok) {
        setError(payload.error || 'Flavor test failed.')
        setResult(payload)
        return
      }

      setResult(payload)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unexpected test runner error.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <article className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-500">Test Runner</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Run a flavor against a test image</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Choose a humor flavor and a test image, then run the existing Humor Project REST API to inspect generated captions.
          </p>
        </div>

        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Humor flavor
            <select className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={flavorId} onChange={(event) => setFlavorId(event.target.value)}>
              {flavors.map((flavor) => (
                <option key={flavor.id} value={flavor.id}>
                  {flavor.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Test image
            <select className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" value={imageId} onChange={(event) => setImageId(event.target.value)}>
              {images.map((image) => (
                <option key={image.id} value={image.id}>
                  {image.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={runTest}
            disabled={isLoading || !flavorId || !imageId}
            className="inline-flex w-fit items-center rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Running flavor…' : 'Run flavor test'}
          </button>

          {error ? <p className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p> : null}
        </div>
      </article>

      <article className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Selected image</p>
        <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
          {selectedImage?.previewUrl ? (
            <Image alt="Selected test image" className="h-72 w-full object-cover" height={420} src={selectedImage.previewUrl} unoptimized width={720} />
          ) : (
            <div className="flex h-72 items-center justify-center text-sm text-slate-500 dark:text-slate-400">No preview available.</div>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{selectedImage?.label || 'Choose an image to preview.'}</p>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Latest run result</p>
          <div className="mt-3 space-y-3">
            {result?.captions?.length ? (
              result.captions.map((caption, index) => (
                <article key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                  {caption.content || caption.text || caption.caption || 'No caption text returned.'}
                </article>
              ))
            ) : result?.raw ? (
              <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                {JSON.stringify(result.raw, null, 2)}
              </pre>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Run a flavor to inspect generated captions here.
              </p>
            )}
          </div>
        </div>
      </article>
    </section>
  )
}
