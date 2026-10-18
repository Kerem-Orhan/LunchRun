// TEMPORARY diagnostic — times outbound requests from Vercel. Delete after debugging.
async function time(label: string, url: string, init?: RequestInit) {
  const t = Date.now()
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) })
    return { label, status: r.status, ms: Date.now() - t }
  } catch (e) {
    return { label, error: String(e), cause: String((e as Error & { cause?: unknown }).cause ?? ''), ms: Date.now() - t }
  }
}

export async function GET(): Promise<Response> {
  const body = JSON.stringify({ locations: [[-74.006, 40.7128], [-74.004, 40.715]], sources: [0], destinations: [1] })
  const results = await Promise.all([
    time('example.com', 'https://example.com'),
    time('ors fake key', 'https://api.openrouteservice.org/v2/matrix/foot-walking', {
      method: 'POST',
      headers: { Authorization: 'fake', 'Content-Type': 'application/json' },
      body,
    }),
    time('ors real key', 'https://api.openrouteservice.org/v2/matrix/foot-walking', {
      method: 'POST',
      headers: { Authorization: process.env.ORS_API_KEY?.trim() ?? '', 'Content-Type': 'application/json' },
      body,
    }),
  ])
  const k = process.env.ORS_API_KEY ?? ''
  // Shape of the key only (length + whether it had whitespace) — never the key itself.
  return Response.json({ results, keyLength: k.length, keyHadWhitespace: k !== k.trim(), node: process.version })
}
