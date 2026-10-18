import { describe, expect, it } from 'vitest'
import {
  checkFeasibility,
  classify,
  distanceMeters,
  leaveBy,
  timeBreakdown,
  withinPrefilter,
  type RoundRules,
} from './feasibility'

const walk35: RoundRules = { lunchMinutes: 35, mode: 'walking', eatMinutes: 15, bufferMinutes: 5 }
const drive45: RoundRules = { lunchMinutes: 45, mode: 'driving', eatMinutes: 15, bufferMinutes: 5 }

describe('timeBreakdown', () => {
  it('adds travel both ways, wait, eat and buffer when walking', () => {
    const b = timeBreakdown(4, 'fast_food', walk35)
    expect(b).toEqual({ travelThere: 4, wait: 5, eat: 15, travelBack: 4, buffer: 5, parking: 0, total: 33 })
  })

  it('adds 3 minutes of parking when driving', () => {
    const b = timeBreakdown(5, 'cafe', drive45)
    expect(b.parking).toBe(3)
    expect(b.total).toBe(5 + 5 + 15 + 5 + 5 + 3)
  })

  it('uses the wait time for each place type', () => {
    expect(timeBreakdown(0, 'fast_food', walk35).wait).toBe(5)
    expect(timeBreakdown(0, 'cafe', walk35).wait).toBe(5)
    expect(timeBreakdown(0, 'food_court', walk35).wait).toBe(8)
    expect(timeBreakdown(0, 'restaurant', walk35).wait).toBe(15)
  })

  it('rounds away floating-point noise', () => {
    expect(timeBreakdown(0.1 + 0.2, 'cafe', walk35).total).toBe(25.6)
  })
})

describe('classify', () => {
  it('is Easy with 5+ minutes to spare (boundary included)', () => {
    expect(classify(30, 35)).toBe('easy')
    expect(classify(20, 35)).toBe('easy')
  })

  it('is Tight when it fits with less than 5 spare (boundary included)', () => {
    expect(classify(30.1, 35)).toBe('tight')
    expect(classify(35, 35)).toBe('tight')
  })

  it('is Hidden when it runs over', () => {
    expect(classify(35.1, 35)).toBe('hidden')
  })
})

describe('checkFeasibility', () => {
  it('a close fast-food spot on a 35-min walk is Easy', () => {
    // 2 + 5 + 15 + 2 + 5 = 29 → 6 spare
    const r = checkFeasibility(2, 'fast_food', walk35)
    expect(r.status).toBe('easy')
    expect(r.spareMinutes).toBe(6)
  })

  it('the same distance at a sit-down restaurant is Hidden', () => {
    // 2 + 15 + 15 + 2 + 5 = 39 > 35
    expect(checkFeasibility(2, 'restaurant', walk35).status).toBe('hidden')
  })

  it('on a 45-min drive lunch, a cafe 10 min away is Hidden but 8 min away is Tight', () => {
    // 10 + 5 + 15 + 10 + 5 + 3 = 48 → over; 8 min drive → 44 → tight
    expect(checkFeasibility(10, 'cafe', drive45).status).toBe('hidden')
    expect(checkFeasibility(8, 'cafe', drive45).status).toBe('tight')
  })

  it('respects custom eat and buffer times', () => {
    const quick: RoundRules = { ...walk35, eatMinutes: 10, bufferMinutes: 0 }
    // 5 + 15 + 10 + 5 + 0 = 35 → tight
    expect(checkFeasibility(5, 'restaurant', quick).status).toBe('tight')
  })

  it('hides places with no route or bad travel data', () => {
    expect(checkFeasibility(null, 'cafe', walk35).status).toBe('hidden')
    expect(checkFeasibility(NaN, 'cafe', walk35).status).toBe('hidden')
    expect(checkFeasibility(-3, 'cafe', walk35).status).toBe('hidden')
  })
})

describe('leaveBy', () => {
  it('subtracts the total from when lunch ends', () => {
    const end = new Date('2026-10-20T12:45:00')
    expect(leaveBy(end, 29).toTimeString().slice(0, 5)).toBe('12:16')
  })

  it('rounds down so the time is never too late', () => {
    const end = new Date('2026-10-20T12:45:00')
    // 29.5 min before 12:45 is 12:15:30 → show 12:15
    expect(leaveBy(end, 29.5).toTimeString().slice(0, 5)).toBe('12:15')
  })
})

describe('distance pre-filter', () => {
  const school = { lat: 40.7128, lng: -74.006 }

  it('measures roughly 111 km per degree of latitude', () => {
    const d = distanceMeters(school, { lat: school.lat + 1, lng: school.lng })
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(112_000)
  })

  it('is zero for the same point', () => {
    expect(distanceMeters(school, school)).toBe(0)
  })

  it('keeps ~1 km places when walking but drops ~2 km ones', () => {
    const oneKm = { lat: school.lat + 0.009, lng: school.lng } // ≈ 1.0 km north
    const twoKm = { lat: school.lat + 0.018, lng: school.lng } // ≈ 2.0 km north
    expect(withinPrefilter(school, oneKm, 'walking')).toBe(true)
    expect(withinPrefilter(school, twoKm, 'walking')).toBe(false)
    expect(withinPrefilter(school, twoKm, 'driving')).toBe(true)
  })
})
