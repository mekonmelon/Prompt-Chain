import { NextResponse } from 'next/server'

type TestRequestBody = {
  flavorId?: string
  imageId?: string
  imageUrl?: string
}

export async function POST(request: Request) {
  const body = (await request.json()) as TestRequestBody
  const endpoint = process.env.HUMOR_PROJECT_TEST_RUN_URL

  if (!endpoint) {
    return NextResponse.json(
      {
        error:
          'HUMOR_PROJECT_TEST_RUN_URL is not configured. Set it to the existing Humor Project REST endpoint for caption generation.',
        raw: body
      },
      { status: 500 }
    )
  }

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      flavor_id: body.flavorId,
      humor_flavor_id: body.flavorId,
      image_id: body.imageId,
      image_url: body.imageUrl
    }),
    cache: 'no-store'
  })

  const text = await upstream.text()
  let parsed: unknown = text

  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: typeof parsed === 'string' ? parsed : (parsed as { error?: string }).error || `Upstream test API failed with ${upstream.status}`,
        raw: parsed
      },
      { status: upstream.status }
    )
  }

  const payload = parsed as { captions?: Array<Record<string, unknown>> }
  return NextResponse.json({
    captions: payload.captions ?? [],
    raw: parsed
  })
}
