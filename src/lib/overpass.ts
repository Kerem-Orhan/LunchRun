/**
 * Finds food near a point using the OpenStreetMap Overpass API (free, no key).
 *
 * Overpass returns raw map elements; `parseOverpass` turns them into clean
 * OsmPlace objects (named places only, nearest first). Parsing is kept
 * separate from fetching so it can be unit-tested with a fixture.
 */
import { distanceMeters, PREFILTER_RADIUS_METERS, type LatLng, type PlaceType, type TravelMode } from './feasibility'

export const PLACE_TYPES: PlaceType[] = ['restaurant', 'fast_food', 'cafe', 'food_court']
export const MAX_CANDIDATES = 50 // matches the /api/matrix limit

export type DietTag = 'halal' | 'vegetarian' | 'vegan'

export interface OsmPlace extends LatLng {
  osmId: string // e.g. "node/123" — stable across days
  name: string
  type: PlaceType
  cuisine: string | null // e.g. "mexican;tacos" → "Mexican, Tacos"
  /** Only tags OSM actually has. Missing ≠ "no" — the UI shows these as "known", never guaranteed. */
  dietTags: DietTag[]
  distanceMeters: number // straight line from the start
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number } // ways/relations, thanks to `out center`
  tags?: Record<string, string>
}

// Public Overpass servers, most reliable first (tested Oct 2026); if one is busy or slow we try the next.
const ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
const ENDPOINT_TIMEOUT_MS = 10_000

/** Overpass QL: every food amenity within `radius` meters, as points (ways get their center). */
export function buildQuery(start: LatLng, radius: number): string {
  const types = PLACE_TYPES.join('|')
  return `[out:json][timeout:20];
nwr["amenity"~"^(${types})$"](around:${Math.round(radius)},${start.lat},${start.lng});
out center tags;`
}

function prettyCuisine(raw: string | undefined): string | null {
  if (!raw) return null
  return raw
    .split(';')
    .map((c) => c.trim().replace(/_/g, ' '))
    .filter(Boolean)
    .slice(0, 2)
    .map((c) => c[0].toUpperCase() + c.slice(1))
    .join(', ')
}

function dietTags(tags: Record<string, string>): DietTag[] {
  // "yes" and "only" both mean the option exists; "limited"/"no" don't count.
  const has = (key: string) => tags[key] === 'yes' || tags[key] === 'only'
  return (['halal', 'vegetarian', 'vegan'] as const).filter((d) => has(`diet:${d}`))
}

/** Raw Overpass JSON → named places, de-duplicated, nearest first, capped at `limit`. */
export function parseOverpass(json: { elements?: OverpassElement[] }, start: LatLng, limit = MAX_CANDIDATES): OsmPlace[] {
  const seen = new Set<string>()
  const places: OsmPlace[] = []

  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {}
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    const type = tags.amenity as PlaceType
    const name = tags.name?.trim()

    if (lat == null || lng == null || !name || !PLACE_TYPES.includes(type)) continue

    // Same chain mapped as both a node and a building outline → keep one.
    const key = `${name.toLowerCase()}@${lat.toFixed(4)},${lng.toFixed(4)}`
    const osmId = `${el.type}/${el.id}`
    if (seen.has(key) || seen.has(osmId)) continue
    seen.add(key)
    seen.add(osmId)

    places.push({
      osmId,
      name,
      type,
      lat,
      lng,
      cuisine: prettyCuisine(tags.cuisine),
      dietTags: dietTags(tags),
      distanceMeters: Math.round(distanceMeters(start, { lat, lng })),
    })
  }

  return places.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, limit)
}

/** Combines the caller's cancel signal with a timeout. */
const withTimeout = (ms: number, signal?: AbortSignal) => {
  const timeout = AbortSignal.timeout(ms)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

/**
 * Fetches nearby food for a travel mode.
 * 1) Our /api/places proxy (server-side, cached for 24h at the edge).
 * 2) If that fails, each public Overpass server directly from the browser.
 */
export async function fetchNearbyPlaces(start: LatLng, mode: TravelMode, signal?: AbortSignal): Promise<OsmPlace[]> {
  const radius = PREFILTER_RADIUS_METERS[mode]
  let lastError: unknown

  try {
    // Rounding to ~10 m means everyone at the same school hits the same cache entry.
    const params = new URLSearchParams({ lat: start.lat.toFixed(4), lng: start.lng.toFixed(4), radius: String(radius) })
    const res = await fetch(`/api/places?${params}`, { signal: withTimeout(40_000, signal) })
    if (!res.ok) throw new Error(`places proxy ${res.status}`)
    return parseOverpass(await res.json(), start)
  } catch (err) {
    if (signal?.aborted) throw err
    lastError = err
  }

  const body = new URLSearchParams({ data: buildQuery(start, radius) })
  for (const url of ENDPOINTS) {
    try {
      // Give up on a slow server after 10s, but still respect the caller cancelling.
      const res = await fetch(url, { method: 'POST', body, signal: withTimeout(ENDPOINT_TIMEOUT_MS, signal) })
      if (!res.ok) throw new Error(`Overpass ${res.status}`)
      return parseOverpass(await res.json(), start)
    } catch (err) {
      if (signal?.aborted) throw err
      lastError = err
    }
  }
  throw new Error('Could not load nearby places. Check your connection and try again.', { cause: lastError })
}
