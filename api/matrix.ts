/**
 * POST /api/matrix — Vercel serverless function.
 *
 * The browser sends the start point and candidate restaurants; this function
 * calls the OpenRouteService Matrix API with our secret key and returns one-way
 * travel minutes. The ORS key lives only in Vercel's env vars (ORS_API_KEY),
 * so it never ships to the browser.
 *
 * Request:  { mode: 'walking' | 'driving', start: {lat, lng}, places: [{lat, lng}, ...] }
 * Response: { minutes: (number | null)[], estimated: boolean }
 *           Same order as `places`; null = unreachable.
 *
 * Walking fallback: ORS's walking service is sometimes slow or down while
 * driving keeps working. If walking doesn't answer in time, we ask the driving
 * service for real street DISTANCES and convert them at walking pace.
 * Those results come back with `estimated: true` so the UI can show "≈".
 */

interface LatLng {
  lat: number
  lng: number
}

const MAX_PLACES = 50 // ORS free tier allows ~3,500 matrix cells per request; we stay well under.
const PROFILES = { walking: 'foot-walking', driving: 'driving-car' } as const
export const WALK_METERS_PER_MINUTE = 80 // ≈ 4.8 km/h, a typical walking pace
const DETOUR_FACTOR = 1.3 // streets vs. straight line (same value as src/lib/routing.ts)

/** Straight-line distance in meters (haversine). */
function straightMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const h =
    Math.sin(toRad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

class OrsError extends Error {
  constructor(public status: number, public detail: string | null) {
    super(detail ?? `ORS ${status}`)
  }
}

function isLatLng(p: unknown): p is LatLng {
  const v = p as LatLng
  return (
    typeof v?.lat === 'number' && typeof v?.lng === 'number' &&
    Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180
  )
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

const round1 = (n: number) => Math.round(n * 10) / 10

/** One row of an ORS matrix: start (index 0) → every place. Throws OrsError or a timeout error. */
async function orsMatrix(
  key: string,
  profile: string,
  locations: number[][],
  metric: 'duration' | 'distance',
  timeoutMs: number,
): Promise<(number | null)[]> {
  const res = await fetch(`https://api.openrouteservice.org/v2/matrix/${profile}`, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locations,
      sources: [0],
      destinations: locations.slice(1).map((_, i) => i + 1),
      metrics: [metric],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!res.ok) {
    // ORS error bodies look like {"error": "..."} or {"error": {"message": "..."}}. They never contain our key.
    const body = (await res.json().catch(() => null)) as { error?: string | { message?: string } } | null
    const detail = typeof body?.error === 'string' ? body.error : (body?.error?.message ?? null)
    throw new OrsError(res.status, detail)
  }

  const data = (await res.json()) as { durations?: (number | null)[][]; distances?: (number | null)[][] }
  return (metric === 'duration' ? data.durations : data.distances)?.[0] ?? []
}

export async function POST(request: Request): Promise<Response> {
  // trim(): a space or newline pasted along with the key makes ORS reject it.
  const key = process.env.ORS_API_KEY?.trim()
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

  try {
    // 1) Real travel times for the chosen mode. Walking gets a short leash so the fallback stays fast.
    try {
      const seconds = await orsMatrix(key, PROFILES[mode], locations, 'duration', mode === 'walking' ? 5_000 : 10_000)
      return json({ minutes: seconds.map((s) => (s == null ? null : round1(s / 60))), estimated: false })
    } catch (err) {
      const recoverable = !(err instanceof OrsError) || err.status >= 500
      if (mode !== 'walking' || !recoverable) throw err
    }

    // 2) Walking fallback: street distances from the driving network, at walking pace.
    //    Cars must follow one-way streets and loop around blocks, which walkers don't,
    //    so each distance is capped at straight-line × detour factor.
    const meters = await orsMatrix(key, PROFILES.driving, locations, 'distance', 8_000)
    const minutes = meters.map((m, i) => {
      const cap = straightMeters(start, places[i]) * DETOUR_FACTOR
      const walk = m == null ? cap : Math.min(m, cap)
      return round1(walk / WALK_METERS_PER_MINUTE)
    })
    return json({ minutes, estimated: true })
  } catch (err) {
    if (err instanceof OrsError) {
      return json({ error: 'Routing service error', orsStatus: err.status, detail: err.detail }, err.status === 429 ? 429 : 502)
    }
    return json({ error: 'Routing service timed out' }, 504)
  }
}
