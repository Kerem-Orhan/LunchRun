/** Summaries of a crew's past winners, for the "your history" card. */
import type { VisitRow } from './types'

export interface HistorySummary {
  /** The most recent winners, newest first. */
  recent: VisitRow[]
  /** Places picked more than once, most picked first. */
  favorites: { name: string; count: number }[]
}

export function summarizeHistory(visits: VisitRow[], recentCount = 2, favoriteCount = 2): HistorySummary {
  const newestFirst = [...visits].sort((a, b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime())

  // Count by OSM id (the same restaurant on different days), remember its display name.
  const counts = new Map<string, { name: string; count: number }>()
  for (const v of newestFirst) {
    const entry = counts.get(v.osm_id) ?? { name: v.name, count: 0 }
    entry.count++
    counts.set(v.osm_id, entry)
  }

  return {
    recent: newestFirst.slice(0, recentCount),
    favorites: [...counts.values()]
      .filter((f) => f.count > 1)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, favoriteCount),
  }
}

/** "Today", "Yesterday", "Mon", or "Oct 3" for older dates. */
export function relativeDay(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
