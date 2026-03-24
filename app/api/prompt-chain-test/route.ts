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

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload),
    cache: 'no-store'
  })

  const responseText = await upstream.text()

  if (!upstream.ok) {
    return NextResponse.json(
      {
        status: upstream.status,
        statusText: upstream.statusText,
        errorText: responseText
      },
      { status: upstream.status }
    )
  }

  try {
    return NextResponse.json(JSON.parse(responseText), { status: upstream.status })
  } catch {
    return NextResponse.json({ rawText: responseText }, { status: upstream.status })
  }
}
