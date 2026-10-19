import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownUp, Check, Crown, Map as MapIcon, Pencil, Search, Send, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { useRound } from '../hooks/useRound'
import { applyView, DEFAULT_VIEW, topCuisines, typesPresent, type BallotView, type SortBy } from '../lib/ballot'
import { decideRound, submitVote } from '../lib/db'
import { formatTime, lunchEndsAt } from '../lib/round'
import type { PlaceRow } from '../lib/types'
import { everyoneHasVoted, recentOsmIds } from '../lib/voting'
import { Button } from './Button'
import { MapView } from './MapView'
import { PlaceCard, TYPE_LABEL } from './PlaceCard'
import { formatCountdown, useNow } from './LiveLunchClock'
import { Avatar, EASE, Screen, ShareButton, Spinner } from './ui'

type RoundData = ReturnType<typeof useRound>

const SORTS: [SortBy, string][] = [
  ['time', 'Quickest'],
  ['distance', 'Closest'],
  ['name', 'A–Z'],
]

export function VoteView({ data }: { data: RoundData }) {
  const { round, crew, places, members, votes, visits, me, myVote, isCreator, result } = data
  const [picks, setPicks] = useState<string[]>([])
  const [veto, setVeto] = useState<string | null>(null)
  const [editing, setEditing] = useState(true)
  const [sending, setSending] = useState(false)
  const [deciding, setDeciding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<BallotView>(DEFAULT_VIEW)
  const loadedVote = useRef(false)

  // Load my saved ballot once (e.g. after a refresh), then show the "submitted" state.
  useEffect(() => {
    if (!myVote || loadedVote.current) return
    loadedVote.current = true
    setPicks([myVote.first_place_id, myVote.second_place_id, myVote.third_place_id].filter((x): x is string => !!x))
    setVeto(myVote.veto_place_id)
    setEditing(false)
  }, [myVote])

  const votedIds = useMemo(() => new Set(votes.map((v) => v.member_id)), [votes])
  const allVoted = everyoneHasVoted(
    members.map((m) => m.id),
    votes.map((v) => ({ memberId: v.member_id })),
  )

  // Auto-decide: once everyone has voted, the creator's phone locks in the winner.
  const autoDecided = useRef(false)
  useEffect(() => {
    if (!isCreator || !allVoted || votes.length === 0 || autoDecided.current || !result?.winnerId) return
    autoDecided.current = true
    const t = setTimeout(() => decide(), 1200) // a beat so the last voter sees their check mark land
    return () => clearTimeout(t)
  }, [isCreator, allVoted, votes.length, result?.winnerId])

  if (!round) return null

  const placeById = new Map(places.map((p) => [p.id, p]))
  const visible = applyView(places, view)
  // Places won in the crew's last few lunches (before this one) — they get the repeat penalty.
  const recent = new Set(
    recentOsmIds(visits.filter((v) => new Date(v.visited_at) < new Date(round.created_at)).map((v) => ({ osmId: v.osm_id, visitedAt: v.visited_at }))),
  )
  const cuisines = topCuisines(places)
  const types = typesPresent(places)
  const filtering = view.type !== 'all' || !!view.cuisine || !!view.query.trim()

  function togglePick(id: string) {
    if (!editing) setEditing(true)
    setError(null)
    if (veto === id) setVeto(null)
    setPicks((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id)
      if (cur.length < 3) return [...cur, id]
      return [cur[0], cur[1], id] // full: replace 3rd choice
    })
  }

  function toggleVeto(id: string) {
    if (!editing) setEditing(true)
    setPicks((cur) => cur.filter((x) => x !== id))
    setVeto((v) => (v === id ? null : id))
  }

  async function send() {
    if (!me || picks.length === 0) return
    setSending(true)
    setError(null)
    try {
      await submitVote(round!.id, me.id, { first: picks[0] ?? null, second: picks[1] ?? null, third: picks[2] ?? null, veto })
      setEditing(false)
      if ('vibrate' in navigator) navigator.vibrate?.(30)
      await data.refetch('votes')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  async function decide() {
    const winner = result?.winnerId ? placeById.get(result.winnerId) : null
    if (!winner) return setError('Nothing to pick yet — every place was vetoed. Change some votes.')
    setDeciding(true)
    try {
      await decideRound(round!, winner)
      await data.refetch('rounds')
    } catch (e) {
      setError((e as Error).message)
      setDeciding(false)
    }
  }

  const shareUrl = `${window.location.origin}/r/${round.id}`
  const canDecide = votes.length > 0 && (isCreator || allVoted)

  return (
    <Screen>
      {/* ---------- Header ---------- */}
      <div className="mb-5">
        {crew && <p className="font-mono text-xs font-semibold tracking-[0.2em] text-ember">CODE {crew.code}</p>}
        <h1 className="mt-1 font-display text-[clamp(2rem,7vw,2.75rem)] leading-[0.95] font-extrabold tracking-[-0.03em]">Pick your top 3</h1>
        <p className="mt-2 text-[15px] text-muted">
          Tap in order of preference. One “No way” veto. Lunch ends <span className="font-semibold text-cream">{formatTime(lunchEndsAt(round))}</span>{' '}
          <BellCountdown endsAt={lunchEndsAt(round)} />
        </p>
      </div>

      {/* ---------- Who's here ---------- */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE, duration: 0.5 }} className="glass mb-4 rounded-2xl p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex -space-x-2">
              <AnimatePresence>
                {members.slice(0, 7).map((m) => (
                  <motion.span key={m.id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} className="relative">
                    <Avatar name={m.display_name} ring={votedIds.has(m.id) ? 'ring-easy' : 'ring-ink'} />
                    {votedIds.has(m.id) && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full bg-easy text-ink ring-2 ring-ink">
                        <Check className="size-2.5" strokeWidth={4} />
                      </motion.span>
                    )}
                  </motion.span>
                ))}
              </AnimatePresence>
              {members.length > 7 && <span className="grid size-9 place-items-center rounded-full bg-ink-3 text-xs font-bold ring-2 ring-ink">+{members.length - 7}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                <span className="tabular-nums">{votes.length}</span> of <span className="tabular-nums">{members.length}</span> voted
              </p>
              <p className="truncate text-xs text-dim">{members.map((m) => m.display_name).join(', ') || 'Waiting for people…'}</p>
            </div>
          </div>
          <ShareButton url={shareUrl} title="LunchRun" />
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-3">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-ember to-easy" initial={{ width: 0 }} animate={{ width: `${members.length ? (votes.length / members.length) * 100 : 0}%` }} transition={{ ease: EASE, duration: 0.8 }} />
        </div>
      </motion.div>

      {/* ---------- Tools: search, sort, map, type + cuisine filters ---------- */}
      <div className="mb-3 grid gap-2.5">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim" />
            <input
              value={view.query}
              onChange={(e) => setView((v) => ({ ...v, query: e.target.value }))}
              placeholder={`Search ${places.length} places`}
              className="h-10 w-full rounded-full bg-ink/60 pr-9 pl-9 text-[15px] text-cream ring-1 ring-cream/10 placeholder:text-dim focus:ring-ember/60 focus:outline-none"
            />
            {view.query && (
              <button
                type="button"
                onClick={() => setView((v) => ({ ...v, query: '' }))}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-dim hover:text-cream"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 transition ${showMap ? 'bg-cream text-ink ring-cream' : 'text-muted ring-cream/10 hover:text-cream'}`}
          >
            <MapIcon className="size-4" /> Map
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ArrowDownUp className="size-4 shrink-0 text-dim" />
          <div className="flex gap-1 rounded-full bg-ink/60 p-1 ring-1 ring-cream/10">
            {SORTS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setView((v) => ({ ...v, sort: k }))}
                className={`h-7 rounded-full px-3 text-xs font-semibold transition ${view.sort === k ? 'bg-cream text-ink' : 'text-muted hover:text-cream'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Horizontally scrolling chips: place types, then cuisines */}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip active={view.type === 'all' && !view.cuisine} onClick={() => setView((v) => ({ ...v, type: 'all', cuisine: null }))}>
            All
          </Chip>
          {types.map((t) => (
            <Chip key={t} active={view.type === t} onClick={() => setView((v) => ({ ...v, type: v.type === t ? 'all' : t }))}>
              {TYPE_LABEL[t]}
            </Chip>
          ))}
          {cuisines.length > 0 && <span className="mx-1 w-px shrink-0 self-stretch bg-cream/10" />}
          {cuisines.map((c) => (
            <Chip key={c} active={view.cuisine === c} accent onClick={() => setView((v) => ({ ...v, cuisine: v.cuisine === c ? null : c }))}>
              {c}
            </Chip>
          ))}
        </div>

        {filtering && (
          <p className="flex items-center justify-between px-1 text-xs text-muted">
            Showing {visible.length} of {places.length}
            <button type="button" onClick={() => setView((v) => ({ ...DEFAULT_VIEW, sort: v.sort }))} className="font-semibold text-ember hover:text-ember-soft">
              Clear filters
            </button>
          </p>
        )}
      </div>

      <AnimatePresence initial={false}>
        {showMap && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ ease: EASE, duration: 0.4 }} className="overflow-hidden">
            <MapView
              start={{ lat: round.start_lat, lng: round.start_lng }}
              pins={visible.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, label: p.name, status: p.status }))}
              selectedId={selected}
              onSelect={(id) => {
                setSelected(id)
                document.getElementById(`place-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
              className="mb-3 h-64"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- Ballot ---------- */}
      <ul className="grid gap-2.5">
        {visible.map((p, i) => (
          <PlaceCard
            key={p.id}
            index={i}
            place={p}
            mode={round.mode}
            estimated={round.estimated}
            rank={picks.includes(p.id) ? picks.indexOf(p.id) + 1 : null}
            vetoed={veto === p.id}
            recent={recent.has(p.osm_id)}
            highlighted={selected === p.id}
            onPick={() => togglePick(p.id)}
            onVeto={() => toggleVeto(p.id)}
          />
        ))}
      </ul>
      {visible.length === 0 && (
        <p className="rounded-2xl border border-dashed border-cream/15 px-4 py-8 text-center text-sm text-dim">Nothing matches. Try another filter.</p>
      )}
      <p className="mt-4 px-1 text-xs text-dim">Diet tags come from OpenStreetMap and may be incomplete. Always double-check.</p>

      {/* ---------- Sticky bar ---------- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-ink via-ink/95 to-transparent px-4 pt-12 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto max-w-xl">
          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-2 rounded-xl bg-veto/10 px-3 py-2 text-center text-sm text-veto ring-1 ring-veto/25">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="glass rounded-3xl p-3">
            <PickSlots picks={picks.map((id) => placeById.get(id))} veto={veto ? placeById.get(veto) : undefined} />
            <div className={`mt-3 grid gap-2 ${canDecide ? 'grid-cols-[1fr_auto]' : ''}`}>
              {editing ? (
                <Button onClick={send} disabled={picks.length === 0 || sending || !me}>
                  {sending ? <Spinner className="size-5" /> : !me ? 'Joining…' : <><Send className="size-5" /> {myVote ? 'Update vote' : 'Send vote'}</>}
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setEditing(true)}>
                  <Check className="size-5 text-easy" /> Vote in · <Pencil className="size-4" /> Change
                </Button>
              )}
              {canDecide && (
                <Button variant="ghost" onClick={decide} disabled={deciding} className="w-auto! px-4">
                  {deciding ? <Spinner className="size-5" /> : <><Crown className="size-5 text-tight" /> Decide</>}
                </Button>
              )}
            </div>
            {!editing && !allVoted && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-dim">
                <Users className="size-3.5" /> Waiting for {members.length - votes.length} more…{isCreator ? ' Picks itself when everyone’s in.' : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </Screen>
  )
}

/** The three ranked slots + veto, shown in the sticky bar. */
function PickSlots({ picks, veto }: { picks: (PlaceRow | undefined)[]; veto?: PlaceRow }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {[0, 1, 2].map((i) => {
        const p = picks[i]
        return (
          <div key={i} className={`relative flex h-11 items-center gap-1.5 overflow-hidden rounded-xl px-2 transition-colors ${p ? 'bg-ember/12 ring-1 ring-ember/40' : 'border border-dashed border-cream/15'}`}>
            <span className={`grid size-5 shrink-0 place-items-center rounded-full font-display text-[11px] font-extrabold ${p ? 'bg-ember text-ink' : 'bg-ink-3 text-dim'}`}>{i + 1}</span>
            {/* New key = remount = a quick slide-in; no exit animation, so fast tapping never lags. */}
            <motion.span key={p?.id ?? 'empty'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`truncate text-xs font-semibold ${p ? 'text-cream' : 'text-dim'}`}>
              {p?.name ?? '—'}
            </motion.span>
          </div>
        )
      })}
      {veto && <p className="col-span-3 truncate px-1 pt-0.5 text-[11px] font-semibold text-veto">No way: {veto.name}</p>}
    </div>
  )
}

function Chip({ active, accent, onClick, children }: { active: boolean; accent?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 shrink-0 rounded-full px-3 text-xs font-semibold whitespace-nowrap ring-1 transition ${
        active ? (accent ? 'bg-ember text-ink ring-ember' : 'bg-cream text-ink ring-cream') : 'bg-ink/40 text-muted ring-cream/10 hover:text-cream'
      }`}
    >
      {children}
    </button>
  )
}

/** Ticking "bell in 32:10" chip. Its own component so only it re-renders every second. */
function BellCountdown({ endsAt }: { endsAt: Date }) {
  const now = useNow(1000)
  const left = (endsAt.getTime() - now) / 1000
  if (left <= 0) return null
  return (
    <span className={`ml-1 inline-flex rounded-full px-2 py-0.5 align-middle font-mono text-xs font-semibold tabular-nums ring-1 ${left < 600 ? 'bg-veto/10 text-veto ring-veto/25' : 'bg-cream/5 text-muted ring-cream/10'}`}>
      bell in {formatCountdown(left)}
    </span>
  )
}
