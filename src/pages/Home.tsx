import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { CodeInput } from '../components/CodeInput'
import { TextField } from '../components/TextField'
import { Spinner } from '../components/ui'
import { isValidCode } from '../lib/codes'
import { createCrew, getCrewByCode } from '../lib/db'
import { getDisplayName, getHostCrew, setDisplayName, setHostCrew } from '../lib/identity'

type Tab = 'create' | 'join'

const STEPS = [
  { title: 'Set up', body: 'The host picks where you’re leaving from and how long lunch is.' },
  { title: 'Vote', body: 'Friends scan the code and rank their top 3. Only places you can make it back from are shown.' },
  { title: 'Go', body: 'Everyone sees the winner, directions, and what time to leave.' },
]

const EASE = [0.16, 1, 0.3, 1] as const

/** Home: a plain tool — start a lunch vote or join one. */
export default function Home() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('create')
  const [name, setName] = useState(getDisplayName)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameOk = name.trim().length > 0

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!nameOk || busy) return
    setDisplayName(name)
    setBusy(true)
    setError(null)
    try {
      // Reuse this device's code from last time, so lunch history (and the
      // "went there recently" penalty) carries over. Otherwise make a new one.
      const saved = getHostCrew()
      const crew = (saved && (await getCrewByCode(saved))) || (await createCrew('Lunch crew'))
      setHostCrew(crew.code)
      // Straight to setting up today's lunch — friends join from the code/QR shown there.
      navigate(`/c/${crew.code}/new`)
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
        setError(`No lunch with code ${fullCode}. Double-check it with your friend.`)
        setBusy(false)
        return
      }
      navigate(`/c/${crew.code}`)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 pb-16 sm:pt-10">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="mb-6">
        <h1 className="font-display text-[2.5rem] leading-[1] font-extrabold tracking-[-0.03em]">Where’s lunch?</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-muted">Start a quick vote with your friends, or join one with a code.</p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.06, ease: EASE }}
        className="glass rounded-3xl p-5"
      >
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
                <motion.span layoutId="tab-pill" className="absolute inset-0 -z-10 rounded-xl bg-cream" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
              )}
              {t === 'create' ? 'Start a lunch' : 'Join with code'}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <TextField
            id="name"
            label="Your name"
            placeholder="So friends know who voted"
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
              transition={{ duration: 0.25, ease: EASE }}
              className="mt-4"
            >
              <Button type="submit" disabled={!nameOk || busy}>
                {busy ? <Spinner className="size-5" /> : <>Start a lunch <ArrowRight className="size-5" /></>}
              </Button>
            </motion.form>
          ) : (
            <motion.form
              key="join"
              onSubmit={handleJoin}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="mt-4 space-y-4"
            >
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-muted">Code from your friend</span>
                <CodeInput value={code} onChange={setCode} onComplete={(c) => handleJoin(undefined, c)} />
              </div>
              <Button type="submit" disabled={!nameOk || !isValidCode(code) || busy}>
                {busy ? <Spinner className="size-5" /> : <>Join <ArrowRight className="size-5" /></>}
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
      </motion.div>

      {/* How it works — plain and short */}
      <motion.ol initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }} className="mt-8 grid gap-4 px-1">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cream/5 font-mono text-xs font-semibold text-muted ring-1 ring-cream/10">{i + 1}</span>
            <p className="text-[15px] leading-snug text-muted">
              <span className="font-semibold text-cream">{s.title}.</span> {s.body}
            </p>
          </li>
        ))}
      </motion.ol>

      <p className="mt-10 text-center text-xs leading-relaxed text-dim">
        Free, no accounts, no ads.
        <br />
        Map data © OpenStreetMap contributors.
      </p>
    </div>
  )
}
