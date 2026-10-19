import { describe, expect, it } from 'vitest'
import { relativeDay, summarizeHistory } from './history'
import type { VisitRow } from './types'

const visit = (osm_id: string, name: string, visited_at: string) => ({ id: visited_at, crew_id: 'c', osm_id, name, visited_at }) as VisitRow

const visits = [
  visit('n1', 'Chipotle', '2026-10-12T16:00:00Z'),
  visit('n2', 'Five Guys', '2026-10-15T16:00:00Z'),
  visit('n1', 'Chipotle', '2026-10-16T16:00:00Z'),
  visit('n3', 'Panera', '2026-10-13T16:00:00Z'),
  visit('n2', 'Five Guys', '2026-10-14T16:00:00Z'),
  visit('n1', 'Chipotle', '2026-10-09T16:00:00Z'),
]

describe('summarizeHistory', () => {
  it('returns the last two winners, newest first', () => {
    expect(summarizeHistory(visits).recent.map((v) => v.name)).toEqual(['Chipotle', 'Five Guys'])
  })

  it('returns places picked more than once, most picked first', () => {
    expect(summarizeHistory(visits).favorites).toEqual([
      { name: 'Chipotle', count: 3 },
      { name: 'Five Guys', count: 2 },
    ])
  })

  it('handles no history', () => {
    expect(summarizeHistory([])).toEqual({ recent: [], favorites: [] })
  })
})

describe('relativeDay', () => {
  const now = new Date('2026-10-18T12:00:00')
  it('says Today / Yesterday / weekday / date', () => {
    expect(relativeDay('2026-10-18T09:00:00', now)).toBe('Today')
    expect(relativeDay('2026-10-17T09:00:00', now)).toBe('Yesterday')
    expect(relativeDay('2026-10-14T09:00:00', now)).toMatch(/Wed/)
    expect(relativeDay('2026-10-01T09:00:00', now)).toMatch(/Oct/)
  })
})
