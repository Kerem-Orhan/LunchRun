/**
 * Picking the winner.
 *
 * 1. Borda count: each ballot's 1st choice = 3 pts, 2nd = 2, 3rd = 1.
 * 2. Veto: a place vetoed by MORE than 1/3 of the crew is knocked out.
 * 3. Repeat penalty: −2 if the crew went there in its last 3 lunches.
 * 4. Tie-break: Easy beats Tight → then shorter total time → then random.
 *
 * Returns the full scoring table (not just the winner) so the results screen
 * can show exactly why a place won.
 */

export const BORDA_POINTS = [3, 2, 1] as const
export const REPEAT_PENALTY = 2
export const REPEAT_LOOKBACK = 3 // how many past lunches count as "recent"

export interface Candidate {
  id: string // places.id
  osmId: string // stable across days, used for the repeat penalty
  status: 'easy' | 'tight'
  totalMinutes: number
}

export interface Ballot {
  memberId: string
  /** Ranked picks, best first. Up to 3; nulls / unknown ids / duplicates are ignored. */
  picks: (string | null)[]
  veto: string | null
}

export interface TallyOptions {
  /** People in the round (including anyone who hasn't voted). Defaults to the number of ballots. */
  memberCount?: number
  /** osm ids of the crew's recent winners (see recentOsmIds). */
  recentOsmIds?: string[]
  /** Injectable for tests; defaults to Math.random. */
  random?: () => number
}

export interface ScoreRow {
  placeId: string
  /** How many ballots ranked it 1st, 2nd, 3rd. */
  firsts: number
  seconds: number
  thirds: number
  borda: number
  vetoes: number
  vetoed: boolean
  repeatPenalty: number // 0 or REPEAT_PENALTY
  score: number // borda − repeatPenalty
  rank: number | null // 1 = winner; null when vetoed out
}

export type TieBreak = 'none' | 'status' | 'time' | 'random'

export interface TallyResult {
  winnerId: string | null
  /** Eligible places, best first, followed by vetoed ones. */
  rows: ScoreRow[]
  /** What separated the winner from 2nd place — shown on the results screen. */
  tieBreak: TieBreak
}

/** True when a place's vetoes exceed one third of the crew. Integer math avoids 1/3 rounding issues. */
export function isVetoedOut(vetoes: number, memberCount: number): boolean {
  return vetoes * 3 > memberCount
}

export function tally(candidates: Candidate[], ballots: Ballot[], options: TallyOptions = {}): TallyResult {
  const memberCount = options.memberCount ?? ballots.length
  const recent = new Set(options.recentOsmIds ?? [])
  const random = options.random ?? Math.random

  const rows = new Map<string, ScoreRow>()
  for (const c of candidates) {
    const penalty = recent.has(c.osmId) ? REPEAT_PENALTY : 0
    rows.set(c.id, {
      placeId: c.id,
      firsts: 0,
      seconds: 0,
      thirds: 0,
      borda: 0,
      vetoes: 0,
      vetoed: false,
      repeatPenalty: penalty,
      score: -penalty,
      rank: null,
    })
  }

  for (const ballot of ballots) {
    // Clean the picks: drop nulls, unknown places and repeats, keep the top 3.
    const seen = new Set<string>()
    const picks = ballot.picks.filter((id): id is string => {
      if (!id || !rows.has(id) || seen.has(id)) return false
      seen.add(id)
      return true
    }).slice(0, BORDA_POINTS.length)

    picks.forEach((id, i) => {
      const row = rows.get(id)!
      row.borda += BORDA_POINTS[i]
      row.score += BORDA_POINTS[i]
      if (i === 0) row.firsts++
      else if (i === 1) row.seconds++
      else row.thirds++
    })

    if (ballot.veto && rows.has(ballot.veto)) rows.get(ballot.veto)!.vetoes++
  }

  for (const row of rows.values()) row.vetoed = isVetoedOut(row.vetoes, memberCount)

  // One random number per place, drawn up front, so sorting stays consistent.
  const byId = new Map(candidates.map((c) => [c.id, { ...c, coin: random() }]))

  const compare = (a: ScoreRow, b: ScoreRow) => {
    const ca = byId.get(a.placeId)!
    const cb = byId.get(b.placeId)!
    if (a.score !== b.score) return b.score - a.score
    if (ca.status !== cb.status) return ca.status === 'easy' ? -1 : 1
    if (ca.totalMinutes !== cb.totalMinutes) return ca.totalMinutes - cb.totalMinutes
    return ca.coin - cb.coin
  }

  const eligible = [...rows.values()].filter((r) => !r.vetoed).sort(compare)
  const vetoed = [...rows.values()].filter((r) => r.vetoed).sort(compare)
  eligible.forEach((r, i) => (r.rank = i + 1))

  const [first, second] = eligible
  return {
    winnerId: first?.placeId ?? null,
    rows: [...eligible, ...vetoed],
    tieBreak: first && second ? explainTieBreak(first, second, byId) : 'none',
  }
}

/** Which rule put the winner ahead of 2nd place ('none' = it simply scored more). */
function explainTieBreak(first: ScoreRow, second: ScoreRow, byId: Map<string, Candidate>): TieBreak {
  if (first.score !== second.score) return 'none'
  const a = byId.get(first.placeId)!
  const b = byId.get(second.placeId)!
  if (a.status !== b.status) return 'status'
  if (a.totalMinutes !== b.totalMinutes) return 'time'
  return 'random'
}

/** osm ids of the crew's last few winners, newest first. */
export function recentOsmIds(visits: { osmId: string; visitedAt: string | Date }[], lookback = REPEAT_LOOKBACK): string[] {
  return [...visits]
    .sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime())
    .slice(0, lookback)
    .map((v) => v.osmId)
}

/** For auto-deciding: has every member in the round submitted a ballot? */
export function everyoneHasVoted(memberIds: string[], ballots: Pick<Ballot, 'memberId'>[]): boolean {
  if (memberIds.length === 0) return false
  const voted = new Set(ballots.map((b) => b.memberId))
  return memberIds.every((id) => voted.has(id))
}
