import { describe, expect, it } from 'vitest'
import { buildQuery, parseOverpass } from './overpass'
import { rankReachable } from './places'

const school = { lat: 40.7128, lng: -74.006 }

const fixture = {
  elements: [
    { type: 'node', id: 1, lat: 40.7138, lon: -74.006, tags: { amenity: 'fast_food', name: 'Taco Spot', cuisine: 'mexican;tacos', 'diet:vegetarian': 'yes', 'diet:halal': 'no' } },
    { type: 'way', id: 2, center: { lat: 40.7129, lon: -74.006 }, tags: { amenity: 'cafe', name: 'Bean There' } },
    { type: 'node', id: 3, lat: 40.72, lon: -74.006, tags: { amenity: 'restaurant', name: 'Far Diner', 'diet:vegan': 'only' } },
    { type: 'node', id: 4, lat: 40.7130, lon: -74.006, tags: { amenity: 'restaurant' } }, // no name → skipped
    { type: 'node', id: 5, lat: 40.7130, lon: -74.006, tags: { amenity: 'bar', name: 'Not Food' } }, // wrong amenity
    { type: 'node', id: 6, lat: 40.71291, lon: -74.00601, tags: { amenity: 'cafe', name: 'Bean There' } }, // dup of way 2
  ],
}

describe('parseOverpass', () => {
  const places = parseOverpass(fixture as never, school)

  it('keeps named food places only, nearest first, without duplicates', () => {
    expect(places.map((p) => p.name)).toEqual(['Bean There', 'Taco Spot', 'Far Diner'])
  })

  it('uses the center for ways and builds stable osm ids', () => {
    expect(places[0]).toMatchObject({ osmId: 'way/2', lat: 40.7129, type: 'cafe' })
  })

  it('reads cuisine and only positive diet tags', () => {
    const taco = places.find((p) => p.name === 'Taco Spot')!
    expect(taco.cuisine).toBe('Mexican, Tacos')
    expect(taco.dietTags).toEqual(['vegetarian']) // halal=no ignored
    expect(places.find((p) => p.name === 'Far Diner')!.dietTags).toEqual(['vegan'])
  })

  it('caps the list', () => {
    expect(parseOverpass(fixture as never, school, 1)).toHaveLength(1)
  })

  it('builds an around query for all four amenity types', () => {
    expect(buildQuery(school, 1200)).toContain('around:1200,40.7128,-74.006')
    expect(buildQuery(school, 1200)).toContain('restaurant|fast_food|cafe|food_court')
  })
})

describe('rankReachable', () => {
  const places = parseOverpass(fixture as never, school)
  const rules = { lunchMinutes: 35, mode: 'walking' as const, eatMinutes: 15, bufferMinutes: 5 }

  it('drops hidden and unroutable places, Easy before Tight', () => {
    // Bean There (cafe) 7 min → 39 hidden; Taco 3 min → 31 tight; Far Diner null → hidden
    const r1 = rankReachable(places, [7, 3, null], rules)
    expect(r1.map((p) => [p.name, p.feasibility.status])).toEqual([['Taco Spot', 'tight']])

    // Bean There 1 min → 27 easy; Taco 3 → 31 tight
    const r2 = rankReachable(places, [1, 3, 30], rules)
    expect(r2.map((p) => p.name)).toEqual(['Bean There', 'Taco Spot'])
  })
})

describe('estimateMinutes (routing fallback)', () => {
  it('walks ~1 km straight-line in about 16 minutes (with street detours)', async () => {
    const { estimateMinutes } = await import('./routing')
    const oneKmNorth = { lat: school.lat + 0.009, lng: school.lng }
    expect(estimateMinutes('walking', school, oneKmNorth)).toBeCloseTo(16.2, 0)
    expect(estimateMinutes('driving', school, oneKmNorth)).toBeCloseTo(2.6, 0)
  })
})

describe('pickBallot', () => {
  it('keeps only the quickest location of each chain', async () => {
    const { pickBallot } = await import('./places')
    const mk = (name: string, total: number) => ({ name, feasibility: { breakdown: { total } } }) as never
    const ballot = pickBallot([mk('Dunkin’', 20), mk('Chipotle', 22), mk('Dunkin', 24), mk('DUNKIN’', 25), mk('Panera', 30)], 3)
    expect(ballot.map((p: { name: string }) => p.name)).toEqual(['Dunkin’', 'Chipotle', 'Panera'])
  })
})
