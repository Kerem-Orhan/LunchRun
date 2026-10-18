/**
 * The full "what can we actually make it to?" pipeline:
 *   Overpass (nearby food) → ORS (real travel times) → feasibility (Easy/Tight/Hidden)
 * Hidden places are dropped here, so the UI never sees them.
 */
import { checkFeasibility, type FeasibilityResult, type LatLng, type RoundRules } from './feasibility'
import { fetchNearbyPlaces, type OsmPlace } from './overpass'
import { fetchTravelMinutes } from './routing'

export interface ReachablePlace extends OsmPlace {
  travelMinutes: number
  feasibility: FeasibilityResult & { status: 'easy' | 'tight' }
}

/** Pure step: attach travel times, keep only places that fit, best first. */
export function rankReachable(places: OsmPlace[], minutes: (number | null)[], rules: RoundRules): ReachablePlace[] {
  return places
    .map((place, i) => ({ place, travel: minutes[i] ?? null }))
    .map(({ place, travel }) => ({ ...place, travelMinutes: travel ?? NaN, feasibility: checkFeasibility(travel, place.type, rules) }))
    .filter((p): p is ReachablePlace => p.feasibility.status !== 'hidden')
    .sort((a, b) => {
      if (a.feasibility.status !== b.feasibility.status) return a.feasibility.status === 'easy' ? -1 : 1
      return a.feasibility.breakdown.total - b.feasibility.breakdown.total
    })
}

/**
 * The ballot: best-first, but only one location per chain (the quickest one),
 * so five Dunkin's don't crowd out everything else.
 */
export function pickBallot(reachable: ReachablePlace[], size: number): ReachablePlace[] {
  const seen = new Set<string>()
  const ballot: ReachablePlace[] = []
  for (const p of reachable) {
    const key = p.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (seen.has(key)) continue
    seen.add(key)
    ballot.push(p)
    if (ballot.length === size) break
  }
  return ballot
}

export interface ReachableResult {
  places: ReachablePlace[]
  /** How many food places were nearby before the time filter (for "12 of 40 fit" copy). */
  nearbyCount: number
  /** True when travel times are estimates rather than real routes. */
  estimated: boolean
}

export async function findReachablePlaces(start: LatLng, rules: RoundRules, signal?: AbortSignal): Promise<ReachableResult> {
  const nearby = await fetchNearbyPlaces(start, rules.mode, signal)
  const { minutes, estimated } = await fetchTravelMinutes(rules.mode, start, nearby, signal)
  return { places: rankReachable(nearby, minutes, rules), nearbyCount: nearby.length, estimated }
}
