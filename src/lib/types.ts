/** Row shapes as stored in Supabase (snake_case, matching supabase/schema.sql). */
import type { PlaceType, TravelMode } from './feasibility'
import type { DietTag } from './overpass'

export interface CrewRow {
  id: string
  code: string
  name: string
  created_at: string
}

export interface RoundRow {
  id: string
  crew_id: string
  start_lat: number
  start_lng: number
  lunch_minutes: number
  mode: TravelMode
  eat_minutes: number
  buffer_minutes: number
  status: 'voting' | 'decided'
  winner_place_id: string | null
  lunch_starts_at: string | null
  creator_client_id: string | null
  estimated: boolean
  created_at: string
}

export interface MemberRow {
  id: string
  round_id: string
  display_name: string
  client_id: string
  joined_at: string
}

export type PriceTag = '$' | '$$' | '$$$'

export interface PlaceRow {
  id: string
  round_id: string
  osm_id: string
  name: string
  type: PlaceType
  lat: number
  lng: number
  travel_minutes: number
  total_minutes: number
  status: 'easy' | 'tight'
  diet_tags: DietTag[]
  price_tag: PriceTag | null
  cuisine: string | null
  distance_meters: number | null
}

export interface VoteRow {
  id: string
  round_id: string
  member_id: string
  first_place_id: string | null
  second_place_id: string | null
  third_place_id: string | null
  veto_place_id: string | null
  created_at: string
}

export interface VisitRow {
  id: string
  crew_id: string
  osm_id: string
  name: string
  visited_at: string
}
