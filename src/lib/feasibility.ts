/**
 * Feasibility: can the crew get to a place, eat, and get back before lunch ends?
 *
 *   total = travel there + wait + eat + travel back + buffer (+ parking if driving)
 *
 *   Easy   → total ≤ lunch − 5   (comfortable)
 *   Tight  → total ≤ lunch       (doable, no dawdling)
 *   Hidden → total > lunch       (never shown)
 *
 * Everything here is pure (no network, no clock reads) so it's easy to test.
 */

export type PlaceType = 'restaurant' | 'fast_food' | 'cafe' | 'food_court'
export type TravelMode = 'walking' | 'driving'
export type FeasibilityStatus = 'easy' | 'tight' | 'hidden'

/** Typical minutes from walking in to having food, by OSM amenity type. */
export const WAIT_MINUTES: Record<PlaceType, number> = {
  fast_food: 5,
  cafe: 5,
  food_court: 8,
  restaurant: 15,
}

export const PARKING_MINUTES = 3 // finding a spot + walking in, driving only
export const EASY_MARGIN_MINUTES = 5 // "Easy" means at least this much spare time
export const DEFAULT_EAT_MINUTES = 15
export const DEFAULT_BUFFER_MINUTES = 5

/**
 * Straight-line pre-filter radius before asking the routing API.
 * Cheap way to skip places that obviously can't work and stay under ORS limits.
 */
export const PREFILTER_RADIUS_METERS: Record<TravelMode, number> = {
  walking: 1200,
  driving: 8000,
}

/** The room's rules — set once by the creator so everyone filters the same way. */
export interface RoundRules {
  lunchMinutes: number
  mode: TravelMode
  eatMinutes: number
  bufferMinutes: number
}

/** Every piece of the time budget, so the UI can draw the LunchClock ring. */
export interface TimeBreakdown {
  travelThere: number
  wait: number
  eat: number
  travelBack: number
  buffer: number
  parking: number
  total: number
}

export interface FeasibilityResult {
  breakdown: TimeBreakdown
  status: FeasibilityStatus
  /** Minutes left over (negative when it doesn't fit). */
  spareMinutes: number
}

/**
 * Adds up the time budget for one place.
 * `travelMinutes` is one way; we assume the trip back takes the same (fine for an MVP).
 */
export function timeBreakdown(travelMinutes: number, type: PlaceType, rules: RoundRules): TimeBreakdown {
  const travelThere = travelMinutes
  const travelBack = travelMinutes
  const wait = WAIT_MINUTES[type]
  const parking = rules.mode === 'driving' ? PARKING_MINUTES : 0
  const total = travelThere + wait + rules.eatMinutes + travelBack + rules.bufferMinutes + parking

  return {
    travelThere,
    wait,
    eat: rules.eatMinutes,
    travelBack,
    buffer: rules.bufferMinutes,
    parking,
    // Round to 0.1 so floating-point noise (e.g. 34.99999) can't flip a status.
    total: Math.round(total * 10) / 10,
  }
}

/** Easy / Tight / Hidden for a total against the lunch length. */
export function classify(totalMinutes: number, lunchMinutes: number): FeasibilityStatus {
  if (totalMinutes <= lunchMinutes - EASY_MARGIN_MINUTES) return 'easy'
  if (totalMinutes <= lunchMinutes) return 'tight'
  return 'hidden'
}

/**
 * Full check for one place. `travelMinutes` can be null when the routing API
 * couldn't find a route — those places are always hidden.
 */
export function checkFeasibility(
  travelMinutes: number | null,
  type: PlaceType,
  rules: RoundRules,
): FeasibilityResult {
  if (travelMinutes == null || !Number.isFinite(travelMinutes) || travelMinutes < 0) {
    const breakdown = timeBreakdown(0, type, rules)
    return { breakdown: { ...breakdown, total: Infinity }, status: 'hidden', spareMinutes: -Infinity }
  }

  const breakdown = timeBreakdown(travelMinutes, type, rules)
  return {
    breakdown,
    status: classify(breakdown.total, rules.lunchMinutes),
    spareMinutes: Math.round((rules.lunchMinutes - breakdown.total) * 10) / 10,
  }
}

/**
 * Latest time you can leave and still be back when lunch ends.
 * Rounded DOWN to the whole minute so "Leave by 12:14" is never too late.
 */
export function leaveBy(lunchEndsAt: Date, totalMinutes: number): Date {
  const ms = lunchEndsAt.getTime() - totalMinutes * 60_000
  return new Date(Math.floor(ms / 60_000) * 60_000)
}

export interface LatLng {
  lat: number
  lng: number
}

/** Straight-line distance in meters (haversine formula). Used only for the pre-filter. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000 // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** True if a place is close enough (as the crow flies) to be worth routing. */
export function withinPrefilter(start: LatLng, place: LatLng, mode: TravelMode): boolean {
  return distanceMeters(start, place) <= PREFILTER_RADIUS_METERS[mode]
}
