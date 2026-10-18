/**
 * Address / school search with Nominatim (OpenStreetMap's free geocoder).
 * Usage policy: max 1 request per second, so calls are spaced out here
 * (the search box also debounces typing).
 */
import type { LatLng } from './feasibility'

export interface GeoResult extends LatLng {
  id: string
  title: string // "Lincoln High School"
  subtitle: string // "123 Main St, Springfield"
}

let lastRequest = 0

export async function searchAddress(query: string, near?: LatLng | null, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim()
  if (q.length < 3) return []

  // Respect the 1 req/sec policy.
  const wait = lastRequest + 1000 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  if (signal?.aborted) return []
  lastRequest = Date.now()

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
  if (!res.ok) throw new Error('Search is busy. Try again in a moment.')

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
