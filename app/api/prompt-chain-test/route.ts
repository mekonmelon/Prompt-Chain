import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
          const text = typeof row.text === 'string' ? row.text : null
          return (content ?? caption ?? text ?? '').trim()
        }

        return ''
      })
      .filter(Boolean)
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>

    if (Array.isArray(obj.captions)) return normalizeGeneratedCaptions(obj.captions)
    if (Array.isArray(obj.data)) return normalizeGeneratedCaptions(obj.data)
    if (Array.isArray(obj.results)) return normalizeGeneratedCaptions(obj.results)
  }

  return []
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession()

  if (sessionError) {
    return NextResponse.json(
      { errorText: `Could not read auth session: ${sessionError.message}` },
      { status: 401 }
    )
  }

  const accessToken = session?.access_token

  if (!accessToken) {
    return NextResponse.json(
      { errorText: 'Not signed in. No Supabase access token found in the current session.' },
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
        'Content-Type': 'application/json',
        Accept: 'application/json'
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
            typeof parsed === 'object' && parsed && 'message' in parsed
              ? String((parsed as Record<string, unknown>).message)
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
