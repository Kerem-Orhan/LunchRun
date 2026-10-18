/**
 * GET /api/places?lat=..&lng=..&radius=.. — Vercel serverless function.
 *
 * Proxies the OpenStreetMap Overpass API (restaurant data) with:
 *  - a proper User-Agent (public Overpass servers block anonymous clients),
 *  - fallback across several public servers,
 *  - a 24h CDN cache, so a school's area loads instantly after the first time
 *    and keeps working even when Overpass is having a bad day.
 *
 * If every Overpass server fails, falls back to Nominatim (OSM's search API,
 * same map data) and reshapes its results to look like Overpass elements.
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

/**
 * Fallback: one Nominatim search per food type inside a box around the start.
 * Nominatim allows 1 request/second, so the searches are spaced out.
 */
async function fromNominatim(lat: number, lng: number, radius: number) {
  const dLat = radius / 111_320
  const dLng = radius / (111_320 * Math.cos((lat * Math.PI) / 180))
  const viewbox = [lng - dLng, lat + dLat, lng + dLng, lat - dLat].map((n) => n.toFixed(5)).join(',')
  const searches = ['restaurant', 'fast food', 'cafe', 'food court']
  const elements: unknown[] = []

  for (let i = 0; i < searches.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100))
    const params = new URLSearchParams({ q: searches[i], format: 'jsonv2', limit: '50', bounded: '1', viewbox, extratags: '1' })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) throw new Error(`nominatim ${res.status}`)
    for (const row of (await res.json()) as NominatimRow[]) {
      if (row.category !== 'amenity' || !TYPES.split('|').includes(row.type)) continue
      // Same shape as an Overpass element, so the browser's parser handles both.
      elements.push({
        type: row.osm_type,
        id: row.osm_id,
        lat: Number(row.lat),
        lon: Number(row.lon),
        tags: { ...(row.extratags ?? {}), amenity: row.type, ...(row.name ? { name: row.name } : {}) },
      })
    }
  }
  return elements
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
  for (const server of SERVERS) {
    try {
      const res = await fetch(server, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(8_000),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as { elements?: unknown[] }
      if (!Array.isArray(data.elements)) throw new Error('bad response')
      // Restaurants don't move: cache at Vercel's edge for a day, serve stale for a week while refreshing.
      return json({ elements: data.elements, source: 'overpass' }, 200, CACHE_DAY)
    } catch (err) {
      errors.push(`${new URL(server).host}: ${(err as Error).message}`)
    }
  }

  try {
    const elements = await fromNominatim(lat, lng, radius)
    return json({ elements, source: 'nominatim' }, 200, CACHE_DAY)
  } catch (err) {
    errors.push(`nominatim: ${(err as Error).message}`)
  }
  return json({ error: 'Restaurant data is unavailable right now', tried: errors }, 502)
}
