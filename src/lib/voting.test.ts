import { describe, expect, it } from 'vitest'
import { everyoneHasVoted, isVetoedOut, recentOsmIds, tally, type Ballot, type Candidate } from './voting'

// Four nearby places. Taco is Easy and quick; Pho is Tight and slow.
const taco: Candidate = { id: 'taco', osmId: 'n1', status: 'easy', totalMinutes: 25 }
const pizza: Candidate = { id: 'pizza', osmId: 'n2', status: 'easy', totalMinutes: 28 }
const pho: Candidate = { id: 'pho', osmId: 'n3', status: 'tight', totalMinutes: 33 }
const bagel: Candidate = { id: 'bagel', osmId: 'n4', status: 'easy', totalMinutes: 22 }
const all = [taco, pizza, pho, bagel]

const ballot = (memberId: string, picks: (string | null)[], veto: string | null = null): Ballot => ({ memberId, picks, veto })
const row = (result: ReturnType<typeof tally>, id: string) => result.rows.find((r) => r.placeId === id)!

describe('Borda count', () => {
  it('gives 3 / 2 / 1 points for 1st / 2nd / 3rd', () => {
    const r = tally(all, [ballot('a', ['taco', 'pizza', 'pho'])])
    expect(row(r, 'taco').borda).toBe(3)
    expect(row(r, 'pizza').borda).toBe(2)
    expect(row(r, 'pho').borda).toBe(1)
    expect(row(r, 'bagel').borda).toBe(0)
  })

  it('picks the place with the most points across ballots', () => {
    const r = tally(all, [
      ballot('a', ['taco', 'pizza', 'pho']), // taco 3, pizza 2, pho 1
      ballot('b', ['pizza', 'pho', 'taco']), // pizza 3, pho 2, taco 1
      ballot('c', ['pizza', 'taco', 'bagel']), // pizza 3, taco 2, bagel 1
    ])
    expect(r.winnerId).toBe('pizza') // 8 vs taco 6
    expect(row(r, 'pizza')).toMatchObject({ firsts: 2, seconds: 1, thirds: 0, score: 8, rank: 1 })
    expect(r.tieBreak).toBe('none')
  })

  it('ignores duplicate, unknown and null picks, and anything past 3', () => {
    const r = tally(all, [ballot('a', ['taco', 'taco', 'ghost', null, 'pizza', 'pho', 'bagel'])])
    expect(row(r, 'taco').borda).toBe(3)
    expect(row(r, 'pizza').borda).toBe(2)
    expect(row(r, 'pho').borda).toBe(1)
    expect(row(r, 'bagel').borda).toBe(0) // would have been a 4th pick
  })

  it('handles partial ballots (only 1 pick)', () => {
    const r = tally(all, [ballot('a', ['pho'])])
    expect(r.winnerId).toBe('pho')
  })
})

describe('veto', () => {
  it('knocks out a place vetoed by more than 1/3 of the crew', () => {
    // 2 of 5 vetoes = 40% > 33% → out, even though it has the most points.
    const r = tally(
      all,
      [
        ballot('a', ['taco', 'pizza']),
        ballot('b', ['taco', 'pizza']),
        ballot('c', ['taco', 'pizza']),
        ballot('d', ['pizza'], 'taco'),
        ballot('e', ['pizza'], 'taco'),
      ],
    )
    expect(row(r, 'taco')).toMatchObject({ vetoes: 2, vetoed: true, rank: null })
    expect(r.winnerId).toBe('pizza')
    expect(r.rows.at(-1)!.placeId).toBe('taco') // vetoed places listed last
  })

  it('keeps a place vetoed by exactly 1/3', () => {
    // 1 of 3 is not MORE than a third.
    const r = tally(all, [ballot('a', ['taco']), ballot('b', ['taco']), ballot('c', ['pizza'], 'taco')])
    expect(row(r, 'taco').vetoed).toBe(false)
    expect(r.winnerId).toBe('taco')
  })

  it('counts members who have not voted yet toward the threshold', () => {
    // 2 vetoes out of 7 members = 28% → stays in.
    const r = tally(all, [ballot('a', ['pizza'], 'taco'), ballot('b', ['pizza'], 'taco')], { memberCount: 7 })
    expect(row(r, 'taco').vetoed).toBe(false)
  })

  it('isVetoedOut boundaries', () => {
    expect(isVetoedOut(1, 3)).toBe(false)
    expect(isVetoedOut(2, 5)).toBe(true)
    expect(isVetoedOut(1, 2)).toBe(true) // 50%
    expect(isVetoedOut(0, 0)).toBe(false)
  })

  it('returns no winner when everything is vetoed', () => {
    const r = tally([taco], [ballot('a', [], 'taco')])
    expect(r.winnerId).toBeNull()
    expect(r.tieBreak).toBe('none')
  })
})

describe('repeat penalty', () => {
  it('subtracts 2 from places the crew went to recently', () => {
    const ballots = [ballot('a', ['taco', 'pizza']), ballot('b', ['pizza', 'taco'])] // tied 5–5
    const r = tally(all, ballots, { recentOsmIds: ['n1'] })
    expect(row(r, 'taco')).toMatchObject({ borda: 5, repeatPenalty: 2, score: 3 })
    expect(r.winnerId).toBe('pizza')
  })

  it('recentOsmIds returns the last 3 winners, newest first', () => {
    const visits = [
      { osmId: 'old', visitedAt: '2026-10-01' },
      { osmId: 'n1', visitedAt: '2026-10-16' },
      { osmId: 'n2', visitedAt: '2026-10-15' },
      { osmId: 'n3', visitedAt: '2026-10-14' },
    ]
    expect(recentOsmIds(visits)).toEqual(['n1', 'n2', 'n3'])
  })
})

describe('tie-breaks', () => {
  it('Easy beats Tight on equal points', () => {
    const r = tally(all, [ballot('a', ['pho', 'taco']), ballot('b', ['taco', 'pho'])])
    expect(r.winnerId).toBe('taco')
    expect(r.tieBreak).toBe('status')
  })

  it('then shorter total time wins', () => {
    const r = tally(all, [ballot('a', ['pizza', 'bagel']), ballot('b', ['bagel', 'pizza'])])
    expect(r.winnerId).toBe('bagel') // 22 min vs 28
    expect(r.tieBreak).toBe('time')
  })

  it('then it is random (deterministic with an injected random)', () => {
    const twinA: Candidate = { id: 'A', osmId: 'a', status: 'easy', totalMinutes: 20 }
    const twinB: Candidate = { id: 'B', osmId: 'b', status: 'easy', totalMinutes: 20 }
    const ballots = [ballot('x', ['A', 'B']), ballot('y', ['B', 'A'])]

    const coins = (...values: number[]) => () => values.shift()!
    expect(tally([twinA, twinB], ballots, { random: coins(0.1, 0.9) }).winnerId).toBe('A')
    expect(tally([twinA, twinB], ballots, { random: coins(0.9, 0.1) }).winnerId).toBe('B')
    expect(tally([twinA, twinB], ballots, { random: coins(0.1, 0.9) }).tieBreak).toBe('random')
  })

  it('with no votes at all, still picks the quickest Easy place', () => {
    expect(tally(all, []).winnerId).toBe('bagel')
  })
})

describe('everyoneHasVoted', () => {
  it('is true only once every member has a ballot', () => {
    expect(everyoneHasVoted(['a', 'b'], [{ memberId: 'a' }])).toBe(false)
    expect(everyoneHasVoted(['a', 'b'], [{ memberId: 'b' }, { memberId: 'a' }])).toBe(true)
    expect(everyoneHasVoted([], [])).toBe(false)
  })
})
