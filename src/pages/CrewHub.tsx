import { motion } from 'motion/react'
import { ArrowRight, History, Plus, SearchX, Trophy, Vote } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { NameGate } from '../components/NameGate'
import { EASE, FullPageLoader, Notice, QRCode, Screen, ScreenHeader, ShareButton } from '../components/ui'
import { getCrewByCode, listRounds, listVisits, subscribeToCrew } from '../lib/db'
import { rememberCrew } from '../lib/identity'
import { formatTime, lunchEndsAt } from '../lib/round'
import type { CrewRow, RoundRow, VisitRow } from '../lib/types'
import { REPEAT_LOOKBACK } from '../lib/voting'

const ACTIVE_WINDOW_MS = 3 * 60 * 60 * 1000 // a vote older than 3h is stale

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

export default function CrewHub() {
  return (
    <NameGate>
      <CrewHubInner />
    </NameGate>
  )
}

function CrewHubInner() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [crew, setCrew] = useState<CrewRow | null>(null)
  const [rounds, setRounds] = useState<RoundRow[]>([])
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const c = await getCrewByCode(code.toUpperCase())
      if (!c) return setStatus('missing')
      rememberCrew(c.code, c.name)
      const [r, v] = await Promise.all([listRounds(c.id), listVisits(c.id)])
      setCrew(c)
      setRounds(r)
      setVisits(v)
      setStatus('ready')
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }, [code])

  useEffect(() => {
    load()
  }, [load])

  // Live: when someone starts a lunch, it shows up here without a refresh.
  useEffect(() => (crew ? subscribeToCrew(crew.id, load) : undefined), [crew, load])

  if (status === 'loading') return <FullPageLoader label="Finding your crew…" />
  if (status === 'missing')
    return (
      <Screen>
        <Notice
          icon={<SearchX className="size-7" />}
          title="No crew with that code"
          body={<>Nothing matches <span className="font-mono text-cream">{code.toUpperCase()}</span>. Check the code with whoever invited you.</>}
          action={<Button onClick={() => navigate('/')}>Back home</Button>}
        />
      </Screen>
    )
  if (status === 'error' || !crew)
    return (
      <Screen>
        <Notice icon={<SearchX className="size-7" />} title="Couldn’t load the crew" body={error} action={<Button onClick={load}>Try again</Button>} />
      </Screen>
    )

  const latest = rounds[0]
  const active = latest && latest.status === 'voting' && Date.now() - new Date(latest.created_at).getTime() < ACTIVE_WINDOW_MS ? latest : null
  const decidedToday = latest && latest.status === 'decided' && isToday(latest.created_at) ? latest : null
  const todaysVisit = decidedToday ? visits.find((v) => isToday(v.visited_at)) : null
  const shareUrl = `${window.location.origin}/c/${crew.code}`

  return (
    <Screen>
      <ScreenHeader
        back="/"
        eyebrow="Crew"
        title={crew.name}
        right={<span className="shrink-0 rounded-xl bg-cream/5 px-3 py-2 font-mono text-sm font-semibold tracking-[0.2em] ring-1 ring-cream/10">{crew.code}</span>}
      />

      {/* ---------- Today ---------- */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="glass relative overflow-hidden rounded-3xl p-5">
        {active ? (
          <>
            <div className="absolute -top-20 -right-20 size-56 rounded-full bg-ember/25 blur-3xl" />
            <p className="relative flex items-center gap-2 text-sm font-semibold text-ember">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-ember opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-ember" />
              </span>
              Voting is live
            </p>
            <h2 className="relative mt-2 font-display text-2xl font-extrabold tracking-tight">Today’s lunch is being decided</h2>
            <p className="relative mt-1 text-[15px] text-muted">
              {active.lunch_minutes} min lunch · {active.mode === 'walking' ? 'walking' : 'driving'} · ends {formatTime(lunchEndsAt(active))}
            </p>
            <Button className="relative mt-5" onClick={() => navigate(`/r/${active.id}`)}>
              <Vote className="size-5" /> Join the vote
            </Button>
          </>
        ) : decidedToday ? (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-easy">
              <Trophy className="size-4" /> Decided
            </p>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight">{todaysVisit ? `Today: ${todaysVisit.name}` : 'Today’s pick is in'}</h2>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              <Button onClick={() => navigate(`/r/${decidedToday.id}`)}>
                See results <ArrowRight className="size-5" />
              </Button>
              <Button variant="ghost" onClick={() => navigate(`/c/${crew.code}/new`)}>
                <Plus className="size-5" /> New lunch
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">Ready for lunch?</h2>
            <p className="mt-1 text-[15px] text-muted">Set the time and travel mode. We’ll find every spot you can make it to and back from.</p>
            <Button className="mt-5" onClick={() => navigate(`/c/${crew.code}/new`)}>
              <Plus className="size-5" /> Start today’s lunch
            </Button>
          </>
        )}
      </motion.section>

      {/* ---------- Invite ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
        className="glass mt-4 flex items-center gap-5 rounded-3xl p-5"
      >
        <QRCode value={shareUrl} className="w-28 shrink-0 sm:w-32" />
        <div className="min-w-0">
          <h2 className="font-display text-xl font-extrabold tracking-tight">Invite the crew</h2>
          <p className="mt-1 text-sm text-muted">
            Scan, or enter <span className="font-mono font-semibold tracking-wider text-cream">{crew.code}</span> on the home screen.
          </p>
          <div className="mt-3">
            <ShareButton url={shareUrl} title={crew.name} />
          </div>
        </div>
      </motion.section>

      {/* ---------- History ---------- */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16, ease: EASE }} className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 px-1 text-xs font-semibold tracking-[0.18em] text-dim uppercase">
          <History className="size-3.5" /> Past lunches
        </h2>
        {visits.length === 0 ? (
          <p className="rounded-2xl px-4 py-6 text-center text-sm text-dim border border-dashed border-cream/15">No lunches yet. Your first winner shows up here.</p>
        ) : (
          <ol className="relative ml-2 border-l border-cream/10">
            {visits.map((v, i) => (
              <li key={v.id} className="relative pb-4 pl-6 last:pb-0">
                <span className={`absolute top-1.5 -left-[5px] size-2.5 rounded-full ${i < REPEAT_LOOKBACK ? 'bg-ember' : 'bg-ink-3'}`} />
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-semibold">{v.name}</span>
                  <span className="shrink-0 text-xs text-dim tabular-nums">
                    {new Date(v.visited_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                {i < REPEAT_LOOKBACK && <p className="text-xs text-ember/80">Recent: −2 points next vote</p>}
              </li>
            ))}
          </ol>
        )}
      </motion.section>

      <p className="mt-10 text-center text-xs text-dim">
        Not your crew? <Link to="/" className="font-semibold text-muted underline-offset-2 hover:underline">Join a different one</Link>
      </p>
    </Screen>
  )
}
