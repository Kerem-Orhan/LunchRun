/**
 * Every Supabase read/write the app does, in one place.
 * Pages call these instead of touching the client directly, so the
 * database rules (what's insert-only, what can be updated) live here.
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { generateCode } from './codes'
import type { LatLng, RoundRules } from './feasibility'
import type { ReachablePlace } from './places'
import { supabase } from './supabase'
import type { CrewRow, MemberRow, PlaceRow, PriceTag, RoundRow, VisitRow, VoteRow } from './types'

/** How many places go on the ballot. More than this makes voting slow on a phone. */
export const BALLOT_SIZE = 15

export class DbError extends Error {}

function db() {
  if (!supabase) throw new DbError('LunchRun isn’t connected to its database yet.')
  return supabase
}

/** Unwraps a Supabase response, turning errors into friendly DbErrors. */
function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) {
    console.error(`[db] ${what}:`, res.error)
    throw new DbError(`Couldn’t ${what}. Check your connection and try again.`)
  }
  return res.data as T
}

// ---------- Crews ----------

export async function createCrew(name: string): Promise<CrewRow> {
  // Codes are random; on the rare clash with an existing code, try again.
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await db().from('crews').insert({ code: generateCode(), name }).select().single()
    if (res.error?.code === '23505') continue // unique violation → new code
    return check(res, 'create the crew')
  }
  throw new DbError('Couldn’t create the crew. Try again.')
}

export async function getCrewByCode(code: string): Promise<CrewRow | null> {
  return check(await db().from('crews').select().eq('code', code).maybeSingle(), 'find that crew')
}

export async function getCrew(id: string): Promise<CrewRow | null> {
  return check(await db().from('crews').select().eq('id', id).maybeSingle(), 'load the crew')
}

export async function listRounds(crewId: string, limit = 10): Promise<RoundRow[]> {
  return check(
    await db().from('rounds').select().eq('crew_id', crewId).order('created_at', { ascending: false }).limit(limit),
    'load lunches',
  )
}

export async function listVisits(crewId: string, limit = 20): Promise<VisitRow[]> {
  return check(
    await db().from('visits').select().eq('crew_id', crewId).order('visited_at', { ascending: false }).limit(limit),
    'load history',
  )
}

// ---------- Rounds ----------

export interface NewRound {
  crewId: string
  start: LatLng
  rules: RoundRules
  lunchStartsAt: Date
  creatorClientId: string
  estimated: boolean
  places: ReachablePlace[]
}

/** Creates the round and its ballot (pass the places already picked with pickBallot). */
export async function createRound(r: NewRound): Promise<RoundRow> {
  const round = check(
    await db()
      .from('rounds')
      .insert({
        crew_id: r.crewId,
        start_lat: r.start.lat,
        start_lng: r.start.lng,
        lunch_minutes: r.rules.lunchMinutes,
        mode: r.rules.mode,
        eat_minutes: r.rules.eatMinutes,
        buffer_minutes: r.rules.bufferMinutes,
        lunch_starts_at: r.lunchStartsAt.toISOString(),
        creator_client_id: r.creatorClientId,
        estimated: r.estimated,
      })
      .select()
      .single(),
    'start the lunch',
  ) as RoundRow

  const rows = r.places.map((p) => ({
    round_id: round.id,
    osm_id: p.osmId,
    name: p.name,
    type: p.type,
    lat: p.lat,
    lng: p.lng,
    travel_minutes: p.travelMinutes,
    total_minutes: p.feasibility.breakdown.total,
    status: p.feasibility.status,
    diet_tags: p.dietTags,
    cuisine: p.cuisine,
    distance_meters: p.distanceMeters,
  }))
  check(await db().from('places').insert(rows), 'save the places')
  return round
}

export async function getRound(id: string): Promise<RoundRow | null> {
  return check(await db().from('rounds').select().eq('id', id).maybeSingle(), 'load the lunch')
}

export async function listPlaces(roundId: string): Promise<PlaceRow[]> {
  return check(await db().from('places').select().eq('round_id', roundId).order('total_minutes'), 'load places')
}

export async function listMembers(roundId: string): Promise<MemberRow[]> {
  return check(await db().from('members').select().eq('round_id', roundId).order('joined_at'), 'load the crew')
}

export async function listVotes(roundId: string): Promise<VoteRow[]> {
  return check(await db().from('votes').select().eq('round_id', roundId), 'load votes')
}

/** Joins (or re-joins) a round. The unique (round_id, client_id) key makes this idempotent. */
export async function joinRound(roundId: string, displayName: string, clientId: string): Promise<MemberRow> {
  const existing = check(
    await db().from('members').select().eq('round_id', roundId).eq('client_id', clientId).maybeSingle(),
    'join the lunch',
  )
  if (existing) return existing
  const res = await db().from('members').insert({ round_id: roundId, display_name: displayName, client_id: clientId }).select().single()
  if (res.error?.code === '23505') {
    // Joined from another tab at the same moment — just read it back.
    return check(await db().from('members').select().eq('round_id', roundId).eq('client_id', clientId).single(), 'join the lunch')
  }
  return check(res, 'join the lunch')
}

export interface Picks {
  first: string | null
  second: string | null
  third: string | null
  veto: string | null
}

/** Insert the ballot, or update just the pick columns if this member already voted. */
export async function submitVote(roundId: string, memberId: string, p: Picks): Promise<void> {
  const picks = { first_place_id: p.first, second_place_id: p.second, third_place_id: p.third, veto_place_id: p.veto }
  const res = await db().from('votes').insert({ round_id: roundId, member_id: memberId, ...picks })
  if (res.error?.code === '23505') {
    check(await db().from('votes').update(picks).eq('round_id', roundId).eq('member_id', memberId), 'update your vote')
    return
  }
  check(res, 'send your vote')
}

export async function setPriceTag(placeId: string, tag: PriceTag | null): Promise<void> {
  check(await db().from('places').update({ price_tag: tag }).eq('id', placeId), 'save the price')
}

/**
 * Marks the round decided and logs the visit for the repeat penalty.
 * The `.eq('status', 'voting')` guard means only the first phone to decide
 * "wins" the update — so two phones deciding at once can't log two visits.
 */
export async function decideRound(round: RoundRow, winner: PlaceRow): Promise<boolean> {
  const updated = check(
    await db()
      .from('rounds')
      .update({ status: 'decided', winner_place_id: winner.id })
      .eq('id', round.id)
      .eq('status', 'voting')
      .select('id'),
    'pick the winner',
  ) as { id: string }[]
  if (updated.length === 0) return false // someone else decided first
  check(await db().from('visits').insert({ crew_id: round.crew_id, osm_id: winner.osm_id, name: winner.name }), 'save history')
  return true
}

// ---------- Realtime ----------

export type RoundTable = 'rounds' | 'members' | 'votes' | 'places'

/**
 * Calls `onChange(table)` whenever anything in this round changes on any phone.
 * Returns an unsubscribe function.
 */
export function subscribeToRound(roundId: string, onChange: (table: RoundTable) => void): () => void {
  if (!supabase) return () => {}
  const client = supabase
  const channel: RealtimeChannel = client
    .channel(`round:${roundId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `id=eq.${roundId}` }, () => onChange('rounds'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `round_id=eq.${roundId}` }, () => onChange('members'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `round_id=eq.${roundId}` }, () => onChange('votes'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'places', filter: `round_id=eq.${roundId}` }, () => onChange('places'))
    .subscribe()
  return () => {
    client.removeChannel(channel)
  }
}

/** Live updates for a crew's lunches (so the hub shows a new vote as soon as it starts). */
export function subscribeToCrew(crewId: string, onChange: () => void): () => void {
  if (!supabase) return () => {}
  const client = supabase
  const channel = client
    .channel(`crew:${crewId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `crew_id=eq.${crewId}` }, onChange)
    .subscribe()
  return () => {
    client.removeChannel(channel)
  }
}

// ---------- Presence (who's here before the vote starts) ----------

export interface PresentPerson {
  clientId: string
  name: string
  host: boolean
}

/**
 * Announces "I'm here" on the crew's presence channel and reports everyone else
 * who is. Nothing is stored in the database — it disappears when the tab closes.
 * The host sees joiners while still adjusting lunch settings.
 */
export function joinCrewPresence(
  crewId: string,
  me: PresentPerson,
  onChange: (people: PresentPerson[]) => void,
): () => void {
  if (!supabase) return () => {}
  const client = supabase
  const channel = client.channel(`presence:${crewId}`, { config: { presence: { key: me.clientId } } })

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresentPerson>()
      // One entry per device (a device can have several tabs open).
      const people = Object.values(state)
        .map((entries) => entries[0])
        .filter(Boolean)
        .map(({ clientId, name, host }) => ({ clientId, name, host }))
      onChange(people)
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track(me)
    })

  return () => {
    client.removeChannel(channel)
  }
}
