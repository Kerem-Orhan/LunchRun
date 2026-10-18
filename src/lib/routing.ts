/**
 * Travel times via our /api/matrix proxy (which holds the ORS key).
 *
 * If the proxy fails completely, we fall back to an estimate from straight-line
 * distance (× a detour factor for real streets) so the app still works.
 * Any estimate is flagged with `estimated: true` so the UI can show "≈".
 *
 * Results are cached per start point + mode for the session, so going back
 * and forth between screens doesn't burn through the free ORS quota.
 */
import { distanceMeters, type LatLng, type TravelMode } from './feasibility'

export interface TravelTimes {
  minutes: (number | null)[] // one-way, same order as the places; null = no route
  estimated: boolean
}

// Straight lines are shorter than streets; ~1.3× is a common rule of thumb for city grids.
export const DETOUR_FACTOR = 1.3
// Walking ≈ 4.8 km/h. Driving in town incl. lights ≈ 30 km/h.
export const METERS_PER_MINUTE: Record<TravelMode, number> = { walking: 80, driving: 500 }

/** Rough one-way minutes from straight-line distance. Used only when routing is unavailable. */
export function estimateMinutes(mode: TravelMode, start: LatLng, place: LatLng): number {
  const meters = distanceMeters(start, place) * DETOUR_FACTOR
  return Math.round((meters / METERS_PER_MINUTE[mode]) * 10) / 10
}

const BATCH_SIZE = 50 // matches MAX_PLACES in api/matrix.ts
const cache = new Map<string, TravelTimes>()

/** One /api/matrix call; on failure, estimates from straight-line distance instead. */
async function fetchBatch(mode: TravelMode, start: LatLng, places: LatLng[], signal?: AbortSignal): Promise<TravelTimes> {
  try {
    const res = await fetch('/api/matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        start: { lat: start.lat, lng: start.lng },
        places: places.map((p) => ({ lat: p.lat, lng: p.lng })),
      }),
      signal,
    })
    if (!res.ok) throw new Error(`matrix ${res.status}`)
    return (await res.json()) as TravelTimes
  } catch (err) {
    if (signal?.aborted) throw err
    // Routing is down — estimate instead of leaving the crew with nothing.
    return { minutes: places.map((p) => estimateMinutes(mode, start, p)), estimated: true }
  }
}

const cacheKey = (mode: TravelMode, start: LatLng, places: LatLng[]) =>
  [mode, start.lat.toFixed(5), start.lng.toFixed(5), ...places.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)].join('|')

export async function fetchTravelMinutes(
  mode: TravelMode,
  start: LatLng,
  places: LatLng[],
  signal?: AbortSignal,
): Promise<TravelTimes> {
  if (places.length === 0) return { minutes: [], estimated: false }

  const key = cacheKey(mode, start, places)
  const hit = cache.get(key)
  if (hit) return hit

  // The proxy takes up to 50 places per request, so split into batches and run them in parallel.
  const batches: LatLng[][] = []
  for (let i = 0; i < places.length; i += BATCH_SIZE) batches.push(places.slice(i, i + BATCH_SIZE))
  const parts = await Promise.all(batches.map((batch) => fetchBatch(mode, start, batch, signal)))
  const result: TravelTimes = { minutes: parts.flatMap((p) => p.minutes), estimated: parts.some((p) => p.estimated) }

  cache.set(key, result)
  return result
}
