/**
 * Address / school search.
 * 1) Photon (komoot) — free OpenStreetMap search built for search-as-you-type.
 * 2) Nominatim (OSM's own geocoder) as a backup. Its policy allows max 1 request
 *    per second, so those calls are spaced out (the search box also debounces typing).
 */
import type { LatLng } from './feasibility'

export interface GeoResult extends LatLng {
  id: string
  title: string // "Lincoln High School"
  subtitle: string // "123 Main St, Springfield"
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: { osm_id?: number; osm_type?: string; name?: string; housenumber?: string; street?: string; city?: string; district?: string; state?: string; postcode?: string }
}

async function searchPhoton(q: string, near: LatLng | null | undefined, signal?: AbortSignal): Promise<GeoResult[]> {
  const params = new URLSearchParams({ q, limit: '6', lang: 'en' })
  if (near) {
    params.set('lat', String(near.lat))
    params.set('lon', String(near.lng))
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal })
  if (!res.ok) throw new Error(`photon ${res.status}`)
  const data = (await res.json()) as { features?: PhotonFeature[] }
  return (data.features ?? []).map((f, i) => {
    const p = f.properties
    const street = [p.housenumber, p.street].filter(Boolean).join(' ')
    const title = p.name || street || p.city || 'Unnamed place'
    return {
      id: `${p.osm_type ?? 'x'}${p.osm_id ?? i}`,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      title,
      subtitle: [p.name ? street : '', p.city || p.district, p.state].filter(Boolean).join(', '),
    }
  })
}

let lastNominatim = 0

async function searchNominatim(q: string, near: LatLng | null | undefined, signal?: AbortSignal): Promise<GeoResult[]> {
  // Respect the 1 req/sec policy.
  const wait = lastNominatim + 1000 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  if (signal?.aborted) return []
  lastNominatim = Date.now()

  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', addressdetails: '0' })
  // Prefer results near the user if we know roughly where they are.
  if (near) {
    const d = 0.5 // ~50 km box
    params.set('viewbox', [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(','))
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal,
    headers: { 'Accept-Language': navigator.language || 'en' },
  })
  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  const rows = (await res.json()) as { place_id: number; lat: string; lon: string; display_name: string; name?: string }[]
  return rows.map((r) => {
    const parts = r.display_name.split(', ')
    const title = r.name || parts[0]
    return {
      id: String(r.place_id),
      lat: Number(r.lat),
      lng: Number(r.lon),
      title,
      subtitle: parts.filter((p) => p !== title).slice(0, 3).join(', '),
    }
  })
}

export async function searchAddress(query: string, near?: LatLng | null, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim()
  if (q.length < 3) return []
  try {
    const results = await searchPhoton(q, near, signal)
    if (results.length > 0) return results
  } catch (err) {
    if (signal?.aborted) return []
    console.warn('[search] Photon failed, trying Nominatim', err)
  }
  try {
    return await searchNominatim(q, near, signal)
  } catch {
    if (signal?.aborted) return []
    throw new Error('Search is busy right now. Try again, or use your location.')
  }
}

/** Browser geolocation as a promise, with readable error messages. */
export function getCurrentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser can’t share location. Search for your school instead.'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Location is blocked. Allow it in your browser settings, or search for your school instead.'
              : 'Couldn’t get your location. Search for your school instead.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    )
  })
}
