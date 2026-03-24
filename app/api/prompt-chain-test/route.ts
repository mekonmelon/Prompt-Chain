import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const API_BASE = 'https://api.almostcrackd.ai'

function normalizeGeneratedCaptions(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === 'string') return item.trim()

        if (item && typeof item === 'object') {
          const row = item as Record<string, unknown>
          const content = typeof row.content === 'string' ? row.content : null
          const caption = typeof row.caption === 'string' ? row.caption : null
          return (content ?? caption ?? '').trim()
        }

        return ''
      })
      .filter(Boolean)
  }

  if (payload && typeof payload === 'object' && 'captions' in payload) {
    return normalizeGeneratedCaptions((payload as { captions?: unknown }).captions)
  }

  return []
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('sb-access-token')?.value

  if (!accessToken) {
    return NextResponse.json(
      { errorText: 'Not signed in. Missing sb-access-token cookie.' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const imageId = typeof body?.imageId === 'string' ? body.imageId.trim() : ''
  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : ''
  const flavorId = typeof body?.flavorId === 'string' ? body.flavorId.trim() : ''

  if (!imageId) {
    return NextResponse.json(
      { errorText: 'Missing imageId.' },
      { status: 400 }
    )
  }

  try {
    const upstream = await fetch(`${API_BASE}/pipeline/generate-captions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ imageId }),
      cache: 'no-store'
    })

    const responseText = await upstream.text()
    let parsed: unknown = null

    try {
      parsed = responseText ? JSON.parse(responseText) : null
    } catch {
      parsed = { rawText: responseText }
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          errorText:
            typeof parsed === 'object' && parsed && 'error' in parsed
              ? String((parsed as Record<string, unknown>).error)
              : responseText || `Upstream failed with ${upstream.status}`,
          upstreamStatus: upstream.status,
          upstreamStatusText: upstream.statusText,
          rawText: responseText
        },
        { status: upstream.status }
      )
    }

    const captionTexts = normalizeGeneratedCaptions(parsed)

    return NextResponse.json({
      flavorId,
      imageId,
      imageUrl,
      captions: captionTexts.map((text, index) => ({
        id: `generated-${index + 1}`,
        caption: text,
        content: text,
        image_url: imageUrl,
        flavor_id: flavorId,
        created_at: new Date().toISOString()
      })),
      rawUpstream: parsed
    })
  } catch (error) {
    return NextResponse.json(
      {
        errorText: error instanceof Error ? error.message : 'Unexpected server error.'
      },
      { status: 500 }
    )
  }
}
