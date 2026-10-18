/**
 * POST /api/matrix — Vercel serverless function.
 *
 * The browser sends the start point and candidate restaurants; this function
 * calls the OpenRouteService Matrix API with our secret key and returns one-way
 * travel minutes. The ORS key lives only in Vercel's env vars (ORS_API_KEY),
 * so it never ships to the browser.
 *
 * Request:  { mode: 'walking' | 'driving', start: {lat, lng}, places: [{lat, lng}, ...] }
 * Response: { minutes: (number | null)[] }  — same order as `places`; null = unreachable
 */

interface LatLng {
  lat: number
  lng: number
}

const MAX_PLACES = 50 // ORS free tier allows ~3,500 matrix cells per request; we stay well under.
const PROFILES = { walking: 'foot-walking', driving: 'driving-car' } as const

function isLatLng(p: unknown): p is LatLng {
  const v = p as LatLng
  return (
    typeof v?.lat === 'number' && typeof v?.lng === 'number' &&
    Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180
  )
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request): Promise<Response> {
  const key = process.env.ORS_API_KEY
  if (!key) return json({ error: 'Server is missing ORS_API_KEY' }, 500)

  let body: { mode?: string; start?: unknown; places?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return json({ error: 'Body must be JSON' }, 400)
  }

  const { mode, start, places } = body
  if (mode !== 'walking' && mode !== 'driving') return json({ error: 'mode must be walking or driving' }, 400)
  if (!isLatLng(start)) return json({ error: 'start must be {lat, lng}' }, 400)
  if (!Array.isArray(places) || places.length === 0 || places.length > MAX_PLACES || !places.every(isLatLng)) {
    return json({ error: `places must be 1–${MAX_PLACES} {lat, lng} points` }, 400)
  }

  // ORS wants [lng, lat] order. Index 0 is the start; 1..n are the places.
  const locations = [start, ...places].map((p) => [p.lng, p.lat])

  const ors = await fetch(`https://api.openrouteservice.org/v2/matrix/${PROFILES[mode]}`, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations,
      sources: [0],
      destinations: places.map((_, i) => i + 1),
      metrics: ['duration'],
    }),
  })

  if (!ors.ok) {
    // Pass rate limits through so the client can back off; hide other details.
    return json({ error: 'Routing service error' }, ors.status === 429 ? 429 : 502)
  }

  const data = (await ors.json()) as { durations?: (number | null)[][] }
  const seconds = data.durations?.[0] ?? []
  const minutes = seconds.map((s) => (s == null ? null : Math.round((s / 60) * 10) / 10))

  return json({ minutes })
}
