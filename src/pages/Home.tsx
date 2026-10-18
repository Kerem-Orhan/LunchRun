import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, ChevronRight, Clock3, MapPin, Scale, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { CodeInput } from '../components/CodeInput'
import { LunchClock, type ClockSegment } from '../components/LunchClock'
import { TextField } from '../components/TextField'
import { Spinner } from '../components/ui'
import { isValidCode } from '../lib/codes'
import { createCrew, getCrewByCode } from '../lib/db'
import { getDisplayName, listRecentCrews, rememberCrew, setDisplayName } from '../lib/identity'

type Tab = 'create' | 'join'

// Example budget for the hero clock (a 35-min lunch at a walkable taco spot).
const DEMO_SEGMENTS: ClockSegment[] = [
  { label: 'Walk there', minutes: 6, color: 'var(--color-ember)' },
  { label: 'Order', minutes: 5, color: 'var(--color-tight)' },
  { label: 'Eat', minutes: 12, color: 'var(--color-easy)' },
  { label: 'Walk back', minutes: 6, color: 'var(--color-ember-soft)' },
  { label: 'Buffer', minutes: 2, color: 'var(--color-plum)' },
]

const FEATURES = [
  { icon: MapPin, title: 'Only reachable spots', body: 'Real walk/drive times. If you can’t make it back, it’s not on the list.' },
  { icon: Users, title: 'Live crew voting', body: 'Everyone ranks a top 3 from their own phone. One veto each.' },
  { icon: Scale, title: 'Fair, visible picks', body: 'Ranked-choice scoring with the math on screen. No more “I don’t care.”' },
]

// Shared stagger for the hero entrance.
const rise = {
  hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { delay: 0.08 * i, duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
  }),
}

export default function Home() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('create')
  const [name, setName] = useState(getDisplayName)
  const [crewName, setCrewName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recent] = useState(listRecentCrews)

  const nameOk = name.trim().length > 0

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!nameOk || busy) return
    setDisplayName(name)
    setBusy(true)
    setError(null)
    try {
      const crew = await createCrew(crewName.trim() || `${name.trim()}’s crew`)
      rememberCrew(crew.code, crew.name)
      navigate(`/c/${crew.code}`)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function handleJoin(e?: FormEvent, fullCode = code) {
    e?.preventDefault()
    if (!nameOk || !isValidCode(fullCode) || busy) return
    setDisplayName(name)
    setBusy(true)
    setError(null)
    try {
      const crew = await getCrewByCode(fullCode)
      if (!crew) {
        setError(`No crew with code ${fullCode}. Double-check it with your friend.`)
        setBusy(false)
        return
      }
      rememberCrew(crew.code, crew.name)
      navigate(`/c/${crew.code}`)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 pt-6 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:pt-14">
      {/* ---------- Hero copy ---------- */}
      <section>
        <motion.div
          custom={0}
          variants={rise}
          initial="hidden"
          animate="show"
          className="inline-flex items-center gap-2 rounded-full bg-cream/5 py-1 pr-3 pl-1 text-[13px] font-medium text-muted ring-1 ring-cream/10"
        >
          <span className="rounded-full bg-ember px-2 py-0.5 text-[11px] font-bold tracking-wide text-ink uppercase">New</span>
          Off-campus lunch, solved
        </motion.div>

        <motion.h1
          custom={1}
          variants={rise}
          initial="hidden"
          animate="show"
          className="mt-5 font-display text-[clamp(2.75rem,9vw,5.25rem)] leading-[0.92] font-extrabold tracking-[-0.04em]"
        >
          35 minutes.
          <br />
          <span className="text-shimmer">Zero debates.</span>
        </motion.h1>

        <motion.p custom={2} variants={rise} initial="hidden" animate="show" className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">
          LunchRun shows your crew only the places you can get to, eat at, and get back from before the bell — then
          everyone votes and you go.
        </motion.p>

        <motion.ul custom={4} variants={rise} initial="hidden" animate="show" className="mt-10 hidden gap-5 lg:grid">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ember/10 text-ember ring-1 ring-ember/20">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-display font-bold">{title}</p>
                <p className="text-[15px] text-muted">{body}</p>
              </div>
            </li>
          ))}
        </motion.ul>
      </section>

      {/* ---------- Clock + action card ---------- */}
      <section className="relative">
        <motion.div custom={2} variants={rise} initial="hidden" animate="show" className="mb-8 hidden lg:block">
          <HeroClock />
        </motion.div>

        <motion.div custom={3} variants={rise} initial="hidden" animate="show" className="glass rounded-3xl p-5 sm:p-6">
          {/* Segmented control with a sliding pill */}
          <div className="relative grid grid-cols-2 rounded-2xl bg-ink/70 p-1 ring-1 ring-cream/5" role="tablist">
            {(['create', 'join'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`relative z-10 h-10 rounded-xl text-[15px] font-semibold transition-colors ${tab === t ? 'text-ink' : 'text-muted hover:text-cream'}`}
              >
                {tab === t && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 -z-10 rounded-xl bg-cream"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                {t === 'create' ? 'Start a crew' : 'Join with code'}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <TextField
              id="name"
              label="Your name"
              placeholder="What should the crew call you?"
              value={name}
              maxLength={24}
              autoComplete="nickname"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Tab bodies cross-fade and slide */}
          <AnimatePresence mode="wait" initial={false}>
            {tab === 'create' ? (
              <motion.form
                key="create"
                onSubmit={handleCreate}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="mt-4 space-y-5"
              >
                <TextField
                  id="crew"
                  label="Crew name"
                  placeholder="5th period lunch"
                  value={crewName}
                  maxLength={32}
                  onChange={(e) => setCrewName(e.target.value)}
                />
                <Button type="submit" disabled={!nameOk || busy}>
                  {busy ? <Spinner className="size-5" /> : <>Create crew <ArrowRight className="size-5" /></>}
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="join"
                onSubmit={handleJoin}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="mt-4 space-y-5"
              >
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-muted">Crew code</span>
                  <CodeInput value={code} onChange={setCode} onComplete={(c) => handleJoin(undefined, c)} />
                </div>
                <Button type="submit" disabled={!nameOk || !isValidCode(code) || busy}>
                  {busy ? <Spinner className="size-5" /> : <>Join crew <ArrowRight className="size-5" /></>}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                role="alert"
                className="mt-4 rounded-xl bg-veto/10 px-3 py-2.5 text-sm font-medium text-veto ring-1 ring-veto/25"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-dim">
            <Clock3 className="size-3.5" /> No accounts. Takes about 20 seconds.
          </p>
        </motion.div>

        {recent.length > 0 && (
          <motion.div custom={4} variants={rise} initial="hidden" animate="show" className="mt-4">
            <p className="mb-2 px-1 text-xs font-semibold tracking-[0.18em] text-dim uppercase">Your crews</p>
            <ul className="grid gap-2">
              {recent.map((c) => (
                <li key={c.code}>
                  <Link
                    to={`/c/${c.code}`}
                    className="group flex items-center justify-between rounded-2xl bg-cream/[0.03] px-4 py-3 ring-1 ring-cream/10 transition hover:bg-cream/[0.06]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{c.name}</span>
                      <span className="font-mono text-xs tracking-widest text-dim">{c.code}</span>
                    </span>
                    <ChevronRight className="size-5 text-dim transition group-hover:translate-x-0.5 group-hover:text-ember" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </section>

      {/* Clock on mobile sits below the card, so the main action stays above the fold */}
      <motion.div custom={6} variants={rise} initial="hidden" animate="show" className="lg:hidden">
        <HeroClock />
      </motion.div>

      {/* Feature list for mobile (desktop shows it in the hero column) */}
      <ul className="grid gap-3 lg:hidden">
        {FEATURES.map(({ icon: Icon, title, body }, i) => (
          <motion.li
            key={title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="glass flex gap-4 rounded-2xl p-4"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ember/10 text-ember ring-1 ring-ember/20">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="font-display font-bold">{title}</p>
              <p className="text-[14px] text-muted">{body}</p>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

/** The lunch clock plus a legend of what each colored arc means. */
function HeroClock() {
  return (
    <div>
      <LunchClock lunchMinutes={35} segments={DEMO_SEGMENTS} caption="Easy · 4 min spare" />
      <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {DEMO_SEGMENTS.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-[13px] text-muted">
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.label} <span className="text-dim tabular-nums">{s.minutes}m</span>
          </span>
        ))}
      </div>
    </div>
  )
}
