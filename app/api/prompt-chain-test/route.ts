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
    console.error('[prompt-chain-test] getSession failed', sessionError)
    return NextResponse.json(
      { errorText: `Could not read auth session: ${sessionError.message}` },
      { status: 401 }
    )
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError) {
    console.error('[prompt-chain-test] getUser failed', userError)
    return NextResponse.json(
      { errorText: `Could not read authenticated user: ${userError.message}` },
      { status: 401 }
    )
  }

  const accessToken = session?.access_token
  const userId = user?.id

  if (!accessToken || !userId) {
    console.error('[prompt-chain-test] missing auth pieces', {
      hasAccessToken: Boolean(accessToken),
      hasUserId: Boolean(userId)
    })
    return NextResponse.json(
      { errorText: 'Not signed in. Missing access token or authenticated user.' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const imageId = typeof body?.imageId === 'string' ? body.imageId.trim() : ''
  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : ''
  const flavorIdRaw = typeof body?.flavorId === 'string' ? body.flavorId.trim() : ''
  const flavorId = Number(flavorIdRaw)

  if (!imageId) {
    return NextResponse.json({ errorText: 'Missing imageId.' }, { status: 400 })
  }

  if (!flavorIdRaw || Number.isNaN(flavorId)) {
    return NextResponse.json({ errorText: 'Missing or invalid flavorId.' }, { status: 400 })
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
      console.error('[prompt-chain-test] upstream failed', {
        status: upstream.status,
        statusText: upstream.statusText,
        parsed
      })

      return NextResponse.json(
        {
          errorText:
            typeof parsed === 'object' && parsed && 'message' in parsed
              ? String((parsed as Record<string, unknown>).message)
              : responseText || `Upstream failed with ${upstream.status}`,
          upstreamStatus: upstream.status,
          upstreamStatusText: upstream.statusText,
          rawUpstream: parsed
        },
        { status: upstream.status }
      )
    }

    const captionTexts = normalizeGeneratedCaptions(parsed)

    if (!captionTexts.length) {
      console.error('[prompt-chain-test] no recognizable captions', { parsed })
      return NextResponse.json(
        {
          errorText: 'Upstream succeeded but returned no recognizable captions.',
          rawUpstream: parsed
        },
        { status: 200 }
      )
    }

    const captionRows = captionTexts.map((text) => ({
      content: text,
      image_id: imageId,
      humor_flavor_id: flavorId,
      is_public: false,
      profile_id: userId,
      created_by_user_id: userId,
      modified_by_user_id: userId
    }))

    const { data: insertedRows, error: insertError } = await supabase
      .from('captions')
      .insert(captionRows)
      .select('id, content, humor_flavor_id, image_id')

    if (insertError) {
      console.error('[prompt-chain-test] insert captions failed', {
        insertError,
        captionRows
      })

      return NextResponse.json(
        {
          errorText: `Captions were generated but could not be saved: ${insertError.message}`,
          rawUpstream: parsed,
          attemptedRows: captionRows
        },
        { status: 500 }
      )
    }

    console.info('[prompt-chain-test] success', {
      savedCount: insertedRows?.length ?? 0,
      flavorId,
      imageId
    })

    return NextResponse.json({
      flavorId: String(flavorId),
      imageId,
      imageUrl,
      savedCount: insertedRows?.length ?? 0,
      savedRows: insertedRows ?? [],
      captions: captionTexts.map((text, index) => ({
        id: `generated-${index + 1}`,
        caption: text,
        content: text,
        image_url: imageUrl,
        flavor_id: String(flavorId),
        created_at: new Date().toISOString()
      })),
      rawUpstream: parsed
    })
  } catch (error) {
    console.error('[prompt-chain-test] unexpected exception', error)
    return NextResponse.json(
      {
        errorText: error instanceof Error ? error.message : 'Unexpected server error.'
      },
      { status: 500 }
    )
  }
}
