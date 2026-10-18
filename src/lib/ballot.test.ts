import { describe, expect, it } from 'vitest'
import { applyView, DEFAULT_VIEW, topCuisines, typesPresent } from './ballot'
import type { PlaceRow } from './types'

const place = (name: string, type: PlaceRow['type'], total: number, dist: number, cuisine: string | null = null) =>
  ({ id: name, name, type, total_minutes: total, travel_minutes: total / 4, distance_meters: dist, cuisine }) as PlaceRow

const places = [
  place('Chipotle', 'fast_food', 40, 3000, 'Mexican'),
  place('Five Guys', 'fast_food', 38, 3100, 'Burger'),
  place('Olive Garden', 'restaurant', 44, 2900, 'Italian, Pizza'),
  place('Starbucks', 'cafe', 30, 800, 'Coffee shop'),
  place('Taco Bell', 'fast_food', 35, 1500, 'Mexican'),
]

describe('applyView', () => {
  it('sorts by total time by default', () => {
    expect(applyView(places, DEFAULT_VIEW).map((p) => p.name)).toEqual(['Starbucks', 'Taco Bell', 'Five Guys', 'Chipotle', 'Olive Garden'])
  })

  it('sorts by distance and by name', () => {
    expect(applyView(places, { ...DEFAULT_VIEW, sort: 'distance' })[0].name).toBe('Starbucks')
    expect(applyView(places, { ...DEFAULT_VIEW, sort: 'distance' }).at(-1)!.name).toBe('Five Guys')
    expect(applyView(places, { ...DEFAULT_VIEW, sort: 'name' })[0].name).toBe('Chipotle')
  })

  it('filters by type, cuisine and search text', () => {
    expect(applyView(places, { ...DEFAULT_VIEW, type: 'fast_food' })).toHaveLength(3)
    expect(applyView(places, { ...DEFAULT_VIEW, cuisine: 'Mexican' }).map((p) => p.name)).toEqual(['Taco Bell', 'Chipotle'])
    expect(applyView(places, { ...DEFAULT_VIEW, cuisine: 'Pizza' }).map((p) => p.name)).toEqual(['Olive Garden'])
    expect(applyView(places, { ...DEFAULT_VIEW, query: 'guy' }).map((p) => p.name)).toEqual(['Five Guys'])
    expect(applyView(places, { ...DEFAULT_VIEW, query: 'coffee' }).map((p) => p.name)).toEqual(['Starbucks'])
  })

  it('does not change the original list', () => {
    const copy = [...places]
    applyView(places, { ...DEFAULT_VIEW, sort: 'name' })
    expect(places).toEqual(copy)
  })
})

describe('filter chips', () => {
  it('lists the most common cuisines first', () => {
    expect(topCuisines(places)[0]).toBe('Mexican')
    expect(topCuisines(places)).toContain('Pizza')
  })

  it('lists only place types that appear', () => {
    expect(typesPresent(places)).toEqual(['fast_food', 'restaurant', 'cafe'])
  })
})
