/** Glue between database rows and the pure feasibility/voting logic. */
import { checkFeasibility, leaveBy, type RoundRules } from './feasibility'
import { seededRandom } from './seeded'
import type { MemberRow, PlaceRow, RoundRow, VisitRow, VoteRow } from './types'
import { recentOsmIds, tally, type Ballot, type Candidate, type TallyResult } from './voting'

export const rulesOf = (r: RoundRow): RoundRules => ({
  lunchMinutes: r.lunch_minutes,
  mode: r.mode,
  eatMinutes: r.eat_minutes,
  bufferMinutes: r.buffer_minutes,
})

/** When lunch ends: start time (or creation time for older rounds) + lunch length. */
export function lunchEndsAt(r: RoundRow): Date {
  const start = new Date(r.lunch_starts_at ?? r.created_at)
  return new Date(start.getTime() + r.lunch_minutes * 60_000)
}

export function leaveByFor(r: RoundRow, place: PlaceRow): Date {
  return leaveBy(lunchEndsAt(r), Number(place.total_minutes))
}

/** Full time breakdown for a stored place (for the LunchClock ring). */
export const breakdownFor = (r: RoundRow, place: PlaceRow) =>
  checkFeasibility(Number(place.travel_minutes), place.type, rulesOf(r))

export function toCandidates(places: PlaceRow[]): Candidate[] {
  return places.map((p) => ({ id: p.id, osmId: p.osm_id, status: p.status, totalMinutes: Number(p.total_minutes) }))
}

export function toBallots(votes: VoteRow[]): Ballot[] {
  return votes.map((v) => ({
    memberId: v.member_id,
    picks: [v.first_place_id, v.second_place_id, v.third_place_id],
    veto: v.veto_place_id,
  }))
}

/**
 * Scores a round the same way on every phone:
 *  - tie-break coin flips are seeded by the round id
 *  - the repeat penalty only counts visits from BEFORE this round
 *    (otherwise this round's own winner would penalize itself on reload)
 */
export function scoreRound(round: RoundRow, places: PlaceRow[], votes: VoteRow[], members: MemberRow[], visits: VisitRow[]): TallyResult {
  const before = visits.filter((v) => new Date(v.visited_at) < new Date(round.created_at))
  return tally(toCandidates(places), toBallots(votes), {
    memberCount: Math.max(members.length, votes.length),
    recentOsmIds: recentOsmIds(before.map((v) => ({ osmId: v.osm_id, visitedAt: v.visited_at }))),
    random: seededRandom(round.id),
  })
}

export const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function directionsLinks(r: RoundRow, place: PlaceRow) {
  const from = `${r.start_lat},${r.start_lng}`
  const to = `${place.lat},${place.lng}`
  return {
    google: `https://www.google.com/maps/dir/?api=1&origin=${from}&destination=${to}&travelmode=${r.mode}`,
    apple: `https://maps.apple.com/?saddr=${from}&daddr=${to}&dirflg=${r.mode === 'walking' ? 'w' : 'd'}`,
  }
}
