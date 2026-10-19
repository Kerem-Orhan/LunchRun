import confetti from 'canvas-confetti'
import { motion } from 'motion/react'
import { Ban, Clock, Navigation, Plus, Repeat2, Scale, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { useRound } from '../hooks/useRound'
import { breakdownFor, directionsLinks, formatTime, leaveByFor, lunchEndsAt } from '../lib/round'
import type { PlaceRow } from '../lib/types'
import { BORDA_POINTS, REPEAT_PENALTY, type TieBreak } from '../lib/voting'
import { Button } from './Button'
import { currentPhase, formatCountdown, LiveLunchClock, useNow, type LiveSegment } from './LiveLunchClock'
import { MapView } from './MapView'
import { TYPE_ICON, TYPE_LABEL } from './PlaceCard'
import { Avatar, EASE, Screen, StatusBadge } from './ui'

type RoundData = ReturnType<typeof useRound>

const TIE_BREAK_COPY: Record<TieBreak, string | null> = {
  none: null,
  status: 'Tied on points. Won the tie-break by being Easy instead of Tight.',
  time: 'Tied on points. Won the tie-break with the shorter total time.',
  random: 'Perfect tie. Won by a coin flip (the same on every phone).',
}

function fireConfetti() {
  const colors = ['#ff6a3d', '#c6f36b', '#ffc94d', '#f6efe7', '#8b6cff']
  const burst = (x: number, angle: number) =>
    confetti({ particleCount: 70, spread: 70, startVelocity: 55, angle, origin: { x, y: 0.75 }, colors, ticks: 220, scalar: 1.05, disableForReducedMotion: true })
  burst(0, 60)
  burst(1, 120)
  setTimeout(() => confetti({ particleCount: 90, spread: 120, startVelocity: 35, origin: { y: 0.35 }, colors, disableForReducedMotion: true }), 250)
}

export function ResultsView({ data }: { data: RoundData }) {
  const { round, crew, places, members, votes, result } = data
  const navigate = useNavigate()
  const now = useNow(1000) // ticks every second for the live countdowns

  const winner = places.find((p) => p.id === round?.winner_place_id) ?? null

  // Voting → results happens on the same page, so jump back up to the winner.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Celebrate once per round per device.
  useEffect(() => {
    if (!round || !winner) return
    const key = `lunchrun:confetti:${round.id}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      /* storage blocked — just celebrate */
    }
    const t = setTimeout(fireConfetti, 500)
    return () => clearTimeout(t)
  }, [round, winner])

  if (!round) return null
  if (!winner || !result) {
    return (
      <Screen>
        <p className="py-20 text-center text-muted">Loading the winner…</p>
      </Screen>
    )
  }

  const Icon = TYPE_ICON[winner.type]
  const { breakdown, spareMinutes } = breakdownFor(round, winner)
  const leave = leaveByFor(round, winner)
  const secondsToLeave = (leave.getTime() - now) / 1000
  const lunchOver = now > lunchEndsAt(round).getTime()
  const links = directionsLinks(round, winner)
  const placeById = new Map(places.map((p) => [p.id, p]))
  const maxScore = Math.max(1, ...result.rows.map((r) => r.score))

  const segments: LiveSegment[] = [
    { label: round.mode === 'walking' ? 'Walk there' : 'Drive there', minutes: breakdown.travelThere, color: 'var(--color-ember)' },
    ...(breakdown.parking ? [{ label: 'Park', minutes: breakdown.parking, color: '#6be0f3' }] : []),
    { label: 'Order', minutes: breakdown.wait, color: 'var(--color-tight)' },
    { label: 'Eat', minutes: breakdown.eat, color: 'var(--color-easy)' },
    { label: round.mode === 'walking' ? 'Walk back' : 'Drive back', minutes: breakdown.travelBack, color: 'var(--color-ember-soft)' },
    { label: 'Buffer', minutes: breakdown.buffer, color: 'var(--color-plum)' },
  ].filter((s) => s.minutes > 0)
  const startsAt = new Date(round.lunch_starts_at ?? round.created_at)
  const phase = currentPhase(now, startsAt, lunchEndsAt(round), segments)

  return (
    <Screen>
      {/* ---------- Winner reveal ---------- */}
      <motion.section
        initial={{ opacity: 0, scale: 0.94, filter: 'blur(12px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.9, ease: EASE }}
        className="glass relative overflow-hidden rounded-[2rem] p-6 text-center"
      >
        <div className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-ember/30 blur-3xl" />
        <motion.div
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.25 }}
          className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-ember text-ink shadow-[0_20px_60px_-10px_var(--color-ember)]"
        >
          <Icon className="size-8" />
        </motion.div>
        <p className="relative mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold tracking-[0.2em] text-ember uppercase">
          <Trophy className="size-3.5" /> Today’s pick
        </p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: EASE }}
          className="relative mt-1 font-display text-[clamp(2.25rem,10vw,3.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance"
        >
          {winner.name}
        </motion.h1>
        <p className="relative mt-2 text-[15px] text-muted">
          {TYPE_LABEL[winner.type]}
          {winner.cuisine ? ` · ${winner.cuisine}` : ''}
        </p>
        <div className="relative mt-3 flex justify-center">
          <StatusBadge status={winner.status} minutes={Number(winner.total_minutes)} estimated={round.estimated} />
        </div>
      </motion.section>

      {/* ---------- Leave by ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.6, ease: EASE }}
        className={`mt-3 flex items-center justify-between gap-4 rounded-3xl px-5 py-4 ring-1 ${
          lunchOver ? 'bg-cream/[0.03] ring-cream/10' : secondsToLeave <= 0 ? 'bg-veto/12 ring-veto/30' : 'bg-easy/10 ring-easy/25'
        }`}
      >
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.18em] text-muted uppercase">
            <Clock className="size-3.5" /> Leave by
          </p>
          <p className="font-display text-4xl font-extrabold tracking-tight tabular-nums">{formatTime(leave)}</p>
        </div>
        <p className={`text-right text-sm font-bold ${lunchOver ? 'text-dim' : secondsToLeave <= 0 ? 'text-veto' : 'text-easy'}`}>
          {lunchOver ? (
            'Lunch is over'
          ) : secondsToLeave <= 0 ? (
            'Go now!'
          ) : (
            <span className="font-mono text-lg tabular-nums">in {formatCountdown(secondsToLeave)}</span>
          )}
          <span className="block text-xs font-medium text-muted">back by {formatTime(lunchEndsAt(round))}</span>
        </p>
      </motion.section>

      {/* ---------- Directions ---------- */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={links.google} target="_blank" rel="noreferrer">
          <Button tabIndex={-1} className="gap-1.5! px-3! text-[15px]! whitespace-nowrap">
            <Navigation className="size-4" /> Google Maps
          </Button>
        </a>
        <a href={links.apple} target="_blank" rel="noreferrer">
          <Button tabIndex={-1} variant="ghost" className="gap-1.5! px-3! text-[15px]! whitespace-nowrap">
            <Navigation className="size-4" /> Apple Maps
          </Button>
        </a>
      </div>

      {/* ---------- Live lunch clock ---------- */}
      <Card title={`Lunch clock · ${winner.status === 'easy' ? 'Easy' : 'Tight'}, ${Math.max(0, Math.round(spareMinutes))} min spare`} delay={0.65}>
        <LiveLunchClock startsAt={startsAt} endsAt={lunchEndsAt(round)} segments={segments} tone={winner.status} />
        <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {segments.map((s, i) => {
            const active = phase.kind === 'segment' && phase.index === i
            return (
              <span key={s.label} className={`inline-flex items-center gap-1.5 text-[13px] transition-colors ${active ? 'font-semibold text-cream' : 'text-muted'}`}>
                <span className={`rounded-full ${active ? 'size-2.5' : 'size-2'}`} style={{ background: s.color }} />
                {s.label} <span className="text-dim tabular-nums">{Math.round(s.minutes)}m</span>
              </span>
            )
          })}
        </div>
        <p className="mt-3 text-center text-xs text-dim">The ring is your whole lunch. Gray is free time; the dot is now.</p>
      </Card>

      {/* ---------- Map ---------- */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }} className="mt-3">
        <MapView
          start={{ lat: round.start_lat, lng: round.start_lng }}
          pins={[{ id: winner.id, lat: winner.lat, lng: winner.lng, label: winner.name, status: winner.status }]}
          selectedId={winner.id}
          routeTo={winner.id}
          className="h-56"
        />
      </motion.div>

      {/* ---------- Who's in ---------- */}
      <Card title={`Who’s in · ${members.length}`} delay={0.8}>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-2 rounded-full bg-cream/5 py-1 pr-3 pl-1 text-sm font-semibold ring-1 ring-cream/10">
              <Avatar name={m.display_name} size="size-7" /> {m.display_name}
            </span>
          ))}
        </div>
      </Card>

      {/* ---------- Scoring breakdown ---------- */}
      <Card title="How it was decided" icon={<Scale className="size-4" />} delay={0.9}>
        <p className="mb-4 text-sm text-muted">
          Ranked-choice points: 1st = {BORDA_POINTS[0]}, 2nd = {BORDA_POINTS[1]}, 3rd = {BORDA_POINTS[2]}. Vetoed by more than ⅓ of the crew = out. Visited in the last 3 lunches = −{REPEAT_PENALTY}.
          {' '}{votes.length} {votes.length === 1 ? 'vote' : 'votes'} counted.
        </p>
        <ol className="grid gap-3">
          {result.rows
            .filter((r) => r.borda > 0 || r.vetoes > 0 || r.placeId === winner.id)
            .map((r, i) => {
              const p = placeById.get(r.placeId) as PlaceRow | undefined
              if (!p) return null
              const isWinner = r.placeId === winner.id
              return (
                <motion.li
                  key={r.placeId}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, ease: EASE, duration: 0.5 }}
                  className={r.vetoed ? 'opacity-60' : ''}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`flex min-w-0 items-center gap-2 font-semibold ${isWinner ? 'text-cream' : 'text-muted'}`}>
                      <span className={`font-mono text-xs ${isWinner ? 'text-ember' : 'text-dim'}`}>{r.rank ?? '—'}</span>
                      <span className={`truncate ${r.vetoed ? 'line-through decoration-veto' : ''}`}>{p.name}</span>
                      {isWinner && <Trophy className="size-3.5 shrink-0 text-ember" />}
                    </span>
                    <span className={`shrink-0 font-display text-lg font-extrabold tabular-nums ${isWinner ? 'text-ember' : ''}`}>{r.score}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-3">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(Math.max(0, r.score) / maxScore) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.06, duration: 0.9, ease: EASE }}
                      className={`h-full rounded-full ${isWinner ? 'bg-gradient-to-r from-ember to-tight' : r.vetoed ? 'bg-veto/50' : 'bg-cream/30'}`}
                    />
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-dim">
                    <span>
                      {r.firsts}× 1st · {r.seconds}× 2nd · {r.thirds}× 3rd
                    </span>
                    {r.repeatPenalty > 0 && (
                      <span className="inline-flex items-center gap-1 text-tight">
                        <Repeat2 className="size-3" /> −{r.repeatPenalty} recent visit
                      </span>
                    )}
                    {r.vetoes > 0 && (
                      <span className={`inline-flex items-center gap-1 ${r.vetoed ? 'text-veto' : ''}`}>
                        <Ban className="size-3" /> {r.vetoes} {r.vetoes === 1 ? 'veto' : 'vetoes'}
                        {r.vetoed ? ' · knocked out' : ''}
                      </span>
                    )}
                  </p>
                </motion.li>
              )
            })}
        </ol>
        {TIE_BREAK_COPY[result.tieBreak] && <p className="mt-4 rounded-xl bg-tight/10 px-3 py-2 text-sm text-tight ring-1 ring-tight/25">{TIE_BREAK_COPY[result.tieBreak]}</p>}
      </Card>

      {crew && (
        <div className="mt-6">
          <Button variant="ghost" onClick={() => navigate(`/c/${crew.code}/new`)}>
            <Plus className="size-5" /> New lunch
          </Button>
        </div>
      )}
      <p className="mt-6 text-center text-xs text-dim">
        Map data © <a href="https://www.openstreetmap.org/copyright" className="underline">OpenStreetMap</a> contributors
      </p>
    </Screen>
  )
}

function Card({ title, icon, delay = 0, children }: { title: string; icon?: React.ReactNode; delay?: number; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.6, ease: EASE }} className="glass mt-3 rounded-3xl p-5">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-dim uppercase">
        {icon}
        {title}
      </h2>
      {children}
    </motion.section>
  )
}
