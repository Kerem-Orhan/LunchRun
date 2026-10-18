/**
 * No accounts: each device gets a random client id plus a display name,
 * both kept in localStorage. Every localStorage call is wrapped because it
 * can throw (private browsing, storage blocked).
 */

const NAME_KEY = 'lunchrun:name'
const CLIENT_KEY = 'lunchrun:client-id'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — the value just won't persist */
  }
}

export function getDisplayName(): string {
  return read(NAME_KEY) ?? ''
}

export function setDisplayName(name: string) {
  write(NAME_KEY, name.trim().slice(0, 24))
}

/** Stable per-device id, so rejoining a room doesn't create a duplicate member. */
export function getClientId(): string {
  let id = read(CLIENT_KEY)
  if (!id) {
    id = crypto.randomUUID()
    write(CLIENT_KEY, id)
  }
  return id
}

// ---------- Recent crews (quick links on Home) ----------

const CREWS_KEY = 'lunchrun:crews'

export interface RecentCrew {
  code: string
  name: string
}

export function listRecentCrews(): RecentCrew[] {
  try {
    const parsed = JSON.parse(read(CREWS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.slice(0, 5) : []
  } catch {
    return []
  }
}

/** Moves this crew to the front of the recent list (max 5). */
export function rememberCrew(code: string, name: string) {
  const rest = listRecentCrews().filter((c) => c.code !== code)
  write(CREWS_KEY, JSON.stringify([{ code, name }, ...rest].slice(0, 5)))
}
