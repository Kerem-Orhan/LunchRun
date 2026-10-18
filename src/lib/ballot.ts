/** Sorting / filtering the ballot on the vote screen. Pure functions, so they're easy to test. */
import type { PlaceType } from './feasibility'
import type { PlaceRow } from './types'

export type SortBy = 'time' | 'distance' | 'name'

export interface BallotView {
  sort: SortBy
  type: PlaceType | 'all'
  cuisine: string | null
  query: string
}

export const DEFAULT_VIEW: BallotView = { sort: 'time', type: 'all', cuisine: null, query: '' }

/** "Mexican, Tacos" → ["Mexican", "Tacos"] */
export const cuisinesOf = (p: Pick<PlaceRow, 'cuisine'>) => (p.cuisine ? p.cuisine.split(',').map((c) => c.trim()).filter(Boolean) : [])

/** The most common cuisines on this ballot (for filter chips), most common first. */
export function topCuisines(places: Pick<PlaceRow, 'cuisine'>[], limit = 10): string[] {
  const counts = new Map<string, number>()
  for (const p of places) for (const c of cuisinesOf(p)) counts.set(c, (counts.get(c) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([c]) => c)
}

/** Place types that actually appear on this ballot, in a fixed order. */
export function typesPresent(places: Pick<PlaceRow, 'type'>[]): PlaceType[] {
  const order: PlaceType[] = ['fast_food', 'restaurant', 'cafe', 'food_court']
  return order.filter((t) => places.some((p) => p.type === t))
}

export function applyView<T extends PlaceRow>(places: T[], view: BallotView): T[] {
  const q = view.query.trim().toLowerCase()
  const filtered = places.filter(
    (p) =>
      (view.type === 'all' || p.type === view.type) &&
      (!view.cuisine || cuisinesOf(p).includes(view.cuisine)) &&
      (!q || p.name.toLowerCase().includes(q) || (p.cuisine ?? '').toLowerCase().includes(q)),
  )
  const dist = (p: PlaceRow) => p.distance_meters ?? Number(p.travel_minutes) * 1000
  return filtered.sort((a, b) => {
    if (view.sort === 'name') return a.name.localeCompare(b.name)
    if (view.sort === 'distance') return dist(a) - dist(b)
    return Number(a.total_minutes) - Number(b.total_minutes)
  })
}
