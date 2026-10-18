/**
 * GET /api/places?lat=..&lng=..&radius=.. — Vercel serverless function.
 *
 * Proxies the OpenStreetMap Overpass API (restaurant data) with:
 *  - a proper User-Agent (public Overpass servers block anonymous clients),
 *  - several public servers raced in parallel,
 *  - a 24h CDN cache, so a school's area loads instantly after the first time
 *    and keeps working even when Overpass is having a bad day.
 *
 * Sources, all OpenStreetMap data, run in parallel; first complete answer wins:
 *  - Geoapify Places (if GEOAPIFY_API_KEY is set) — one fast request, most reliable
 *  - public Overpass servers
 *  - a Nominatim crawl (results reshaped to look like Overpass elements)
 *
 * Returns Overpass-style JSON ({ elements: [...], source }); the browser parses it
 * with parseOverpass() in src/lib/overpass.ts.
 */

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
const USER_AGENT = 'LunchRun/1.0 (student project; https://github.com/Kerem-Orhan/LunchRun)'
const TYPES = 'restaurant|fast_food|cafe|food_court' // keep in sync with PLACE_TYPES in src/lib/overpass.ts
const MAX_RADIUS = 10_000

const CACHE_DAY = 'public, s-maxage=86400, stale-while-revalidate=604800'

const json = (body: unknown, status: number, cache = 'no-store') =>
  Response.json(body, { status, headers: { 'Cache-Control': cache } })

interface NominatimRow {
  osm_type: 'node' | 'way' | 'relation'
  osm_id: number
  lat: string
  lon: string
  name?: string
  category: string
  type: string
  extratags?: Record<string, string> | null
}

interface GeoapifyFeature {
  properties: {
    name?: string
    lat: number
    lon: number
    categories?: string[]
    datasource?: { raw?: Record<string, string | number> }
  }
}

/**
 * Primary source when GEOAPIFY_API_KEY is set: Geoapify Places (free tier, built on
 * OpenStreetMap). One request returns up to 500 places in the circle, with OSM tags.
 */
async function fromGeoapify(key: string, lat: number, lng: number, radius: number) {
  const params = new URLSearchParams({
    categories: 'catering.restaurant,catering.fast_food,catering.cafe,catering.food_court',
    filter: `circle:${lng},${lat},${Math.round(radius)}`,
    bias: `proximity:${lng},${lat}`,
    limit: '500',
    apiKey: key,
  })
  const res = await fetch(`https://api.geoapify.com/v2/places?${params}`, { signal: AbortSignal.timeout(12_000) })
  if (!res.ok) throw new Error(`geoapify ${res.status}`)
  const data = (await res.json()) as { features?: GeoapifyFeature[] }

  const typeOf = (cats: string[] = []) =>
    cats.includes('catering.fast_food') ? 'fast_food'
    : cats.includes('catering.food_court') ? 'food_court'
    : cats.includes('catering.cafe') ? 'cafe'
    : 'restaurant'
  const OSM_TYPE: Record<string, string> = { n: 'node', w: 'way', r: 'relation' }

  return (data.features ?? []).map(({ properties: p }, i) => {
    const raw = p.datasource?.raw ?? {}
    const tags: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'string') tags[k] = v
    // Same shape as an Overpass element, so the browser's parser handles every source.
    return {
      type: OSM_TYPE[String(raw.osm_type)] ?? 'node',
      id: Number(raw.osm_id ?? i),
      lat: p.lat,
      lon: p.lon,
      tags: { ...tags, amenity: TYPES.split('|').includes(tags.amenity) ? tags.amenity : typeOf(p.categories), ...(p.name ? { name: p.name } : {}) },
    }
  })
}

interface Box {
  west: number
  north: number
  east: number
  south: number
}

const NOMINATIM_PAGE = 50 // Nominatim returns at most this many results per search
const NOMINATIM_MAX_REQUESTS = 28 // ~30s worst case at 1 request/second
const MIN_TILE_DEG = 0.008 // ~900 m — don't split smaller than this

/**
 * Fallback: Nominatim search per food type, with adaptive tiling.
 * A search that comes back full (50 results) was probably cut off, so that box
 * is split into 4 smaller boxes and searched again. Requests are spaced 1.1s
 * apart to respect Nominatim's 1 request/second policy.
 */
async function fromNominatim(lat: number, lng: number, radius: number, signal: AbortSignal) {
  const dLat = radius / 111_320
  const dLng = radius / (111_320 * Math.cos((lat * Math.PI) / 180))
  const whole: Box = { west: lng - dLng, north: lat + dLat, east: lng + dLng, south: lat - dLat }

  const queue: { q: string; box: Box }[] = ['fast food', 'restaurant', 'cafe', 'food court'].map((q) => ({ q, box: whole }))
  const found = new Map<string, unknown>()
  let requests = 0

  while (queue.length && requests < NOMINATIM_MAX_REQUESTS && !signal.aborted) {
    const { q, box } = queue.shift()!
    if (requests > 0) await new Promise((r) => setTimeout(r, 1100))
    requests++

    const viewbox = [box.west, box.north, box.east, box.south].map((n) => n.toFixed(5)).join(',')
    const params = new URLSearchParams({ q, format: 'jsonv2', limit: String(NOMINATIM_PAGE), bounded: '1', viewbox, extratags: '1' })
    let rows: NominatimRow[]
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
      })
      if (!res.ok) throw new Error(`nominatim ${res.status}`)
      rows = (await res.json()) as NominatimRow[]
    } catch (err) {
      // Rate-limited or slow: keep whatever we already found rather than failing.
      if (found.size > 0) break
      throw err
    }

    for (const row of rows) {
      if (row.category !== 'amenity' || !TYPES.split('|').includes(row.type)) continue
      // Same shape as an Overpass element, so the browser's parser handles both.
      found.set(`${row.osm_type}/${row.osm_id}`, {
        type: row.osm_type,
        id: row.osm_id,
        lat: Number(row.lat),
        lon: Number(row.lon),
        tags: { ...(row.extratags ?? {}), amenity: row.type, ...(row.name ? { name: row.name } : {}) },
      })
    }

    // Full page → results were cut off → search the 4 quarters of this box.
    if (rows.length >= NOMINATIM_PAGE && box.east - box.west > MIN_TILE_DEG) {
      const midLng = (box.west + box.east) / 2
      const midLat = (box.north + box.south) / 2
      queue.push(
        { q, box: { west: box.west, north: box.north, east: midLng, south: midLat } },
        { q, box: { west: midLng, north: box.north, east: box.east, south: midLat } },
        { q, box: { west: box.west, north: midLat, east: midLng, south: box.south } },
        { q, box: { west: midLng, north: midLat, east: box.east, south: box.south } },
      )
    }
  }
  if (found.size === 0) throw new Error('no results')
  return [...found.values()]
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const lat = Number(url.searchParams.get('lat'))
  const lng = Number(url.searchParams.get('lng'))
  const radius = Number(url.searchParams.get('radius'))

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'lat and lng are required' }, 400)
  }
  if (!Number.isFinite(radius) || radius <= 0 || radius > MAX_RADIUS) {
    return json({ error: `radius must be 1–${MAX_RADIUS} meters` }, 400)
  }

  const query = `[out:json][timeout:25];
nwr["amenity"~"^(${TYPES})$"](around:${Math.round(radius)},${lat},${lng});
out center tags;`

  const errors: string[] = []

  // Lets us stop the slow Nominatim crawl as soon as Overpass answers.
  const stopNominatim = new AbortController()

  async function fromOverpass(server: string) {
    try {
      const res = await fetch(server, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(12_000),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as { elements?: unknown[] }
      if (!Array.isArray(data.elements)) throw new Error('bad response')
      stopNominatim.abort() // Overpass has complete data; no need to keep crawling
      return { elements: data.elements, source: new URL(server).host }
    } catch (err) {
      errors.push(`${new URL(server).host}: ${(err as Error).message}`)
      throw err
    }
  }

  async function geoapify(key: string) {
    try {
      const elements = await fromGeoapify(key, lat, lng, radius)
      stopNominatim.abort()
      return { elements, source: 'geoapify' }
    } catch (err) {
      errors.push(`geoapify: ${(err as Error).message}`)
      throw err
    }
  }

  async function nominatim() {
    try {
      return { elements: await fromNominatim(lat, lng, radius, stopNominatim.signal), source: 'nominatim' }
    } catch (err) {
      errors.push(`nominatim: ${(err as Error).message}`)
      throw err
    }
  }

  // Ask every source at once. Geoapify / Overpass (complete data, fast) normally win;
  // the Nominatim crawl is the safety net when they're unavailable.
  try {
    const key = process.env.GEOAPIFY_API_KEY?.trim()
    if (!key) errors.push('geoapify: GEOAPIFY_API_KEY not set')
    const result = await Promise.any([...(key ? [geoapify(key)] : []), ...SERVERS.map(fromOverpass), nominatim()])
    // Restaurants don't move: cache at Vercel's edge for a day, serve stale for a week while refreshing.
    // `skipped` lists sources that failed before the winner answered (useful for debugging; no secrets).
    return json({ ...result, skipped: [...errors] }, 200, CACHE_DAY)
  } catch {
    /* every source failed — fall through */
  }
  return json({ error: 'Restaurant data is unavailable right now', tried: errors }, 502)
}
