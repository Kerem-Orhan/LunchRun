// TEMPORARY diagnostic — times outbound requests from Vercel. Delete after debugging.
async function time(label: string, url: string, init?: RequestInit) {
  const t = Date.now()
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(25000) })
    const text = await r.text()
    return { label, status: r.status, ms: Date.now() - t, body: text.slice(0, 200) }
  } catch (e) {
    return { label, error: String(e), ms: Date.now() - t }
  }
}

export const config = { maxDuration: 60 }

export async function GET(): Promise<Response> {
  const key = process.env.ORS_API_KEY?.trim() ?? ''
  const auth = { Authorization: key, 'Content-Type': 'application/json' }
  const body = JSON.stringify({ locations: [[-74.006, 40.7128], [-74.004, 40.715]], sources: [0], destinations: [1] })
  const results = await Promise.all([
    time('matrix walking', 'https://api.openrouteservice.org/v2/matrix/foot-walking', { method: 'POST', headers: auth, body }),
    time('matrix driving', 'https://api.openrouteservice.org/v2/matrix/driving-car', { method: 'POST', headers: auth, body }),
    time('directions GET', `https://api.openrouteservice.org/v2/directions/foot-walking?api_key=${encodeURIComponent(key)}&start=-74.006,40.7128&end=-74.004,40.715`),
  ])
  // Don't echo the key: strip it from any body text just in case.
  return Response.json({ results: results.map((r) => ({ ...r, body: r.body?.split(key).join('[key]') })) })
}
