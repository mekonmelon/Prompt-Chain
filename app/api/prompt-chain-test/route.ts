import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const payload = await request.json()
  const endpoint = process.env.HUMOR_PROJECT_REST_API_URL

  if (!endpoint) {
    return NextResponse.json(
      {
        errorText:
          'HUMOR_PROJECT_REST_API_URL is not configured. Point it at the Assignment 5-compatible caption test endpoint to enable live flavor testing.'
      },
      { status: 500 }
    )
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    })

    const contentType = upstream.headers.get('content-type') || ''
    const responseText = await upstream.text()

    return NextResponse.json(
      {
        upstreamStatus: upstream.status,
        upstreamStatusText: upstream.statusText,
        upstreamContentType: contentType,
        parsed: contentType.includes('application/json')
          ? (() => {
              try {
                return JSON.parse(responseText)
              } catch {
                return null
              }
            })()
          : null,
        rawText: responseText
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        errorText: error instanceof Error ? error.message : 'Unknown upstream fetch error'
      },
      { status: 500 }
    )
  }
}
