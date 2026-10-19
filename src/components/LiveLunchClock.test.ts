import { describe, expect, it } from 'vitest'
import { currentPhase, formatCountdown } from './LiveLunchClock'

// 45-min lunch 12:00–12:45; the trip is 30 min, so you leave at 12:15.
const start = new Date('2026-10-20T12:00:00')
const end = new Date('2026-10-20T12:45:00')
const segs = [
  { label: 'Drive there', minutes: 5, color: '' },
  { label: 'Order', minutes: 5, color: '' },
  { label: 'Eat', minutes: 15, color: '' },
  { label: 'Drive back', minutes: 5, color: '' },
]
const at = (hhmmss: string) => new Date(`2026-10-20T${hhmmss}`).getTime()

describe('currentPhase', () => {
  it('counts down to lunch, then to leaving', () => {
    expect(currentPhase(at('11:58:00'), start, end, segs)).toMatchObject({ kind: 'before', secondsLeft: 120 })
    expect(currentPhase(at('12:10:00'), start, end, segs)).toMatchObject({ kind: 'free', secondsLeft: 300 })
  })

  it('tracks which step of the trip you are on', () => {
    expect(currentPhase(at('12:16:00'), start, end, segs)).toMatchObject({ kind: 'segment', index: 0, secondsLeft: 240 })
    expect(currentPhase(at('12:30:00'), start, end, segs)).toMatchObject({ kind: 'segment', index: 2 })
    expect(currentPhase(at('12:44:30'), start, end, segs)).toMatchObject({ kind: 'segment', index: 3, secondsLeft: 30 })
  })

  it('is over at the bell', () => {
    expect(currentPhase(at('12:45:00'), start, end, segs).kind).toBe('over')
  })
})

describe('formatCountdown', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatCountdown(754)).toBe('12:34')
    expect(formatCountdown(5.2)).toBe('0:06')
    expect(formatCountdown(3723)).toBe('1:02:03')
    expect(formatCountdown(-4)).toBe('0:00')
  })
})
