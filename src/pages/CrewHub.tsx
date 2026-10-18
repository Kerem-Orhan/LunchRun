import { motion } from 'motion/react'
import { SearchX } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { NameGate } from '../components/NameGate'
import { Avatar, EASE, FullPageLoader, Notice, Screen } from '../components/ui'
import { getCrewByCode, joinCrewPresence, listRounds, subscribeToCrew, type PresentPerson } from '../lib/db'
import { getClientId, getDisplayName } from '../lib/identity'
import type { CrewRow } from '../lib/types'

const ACTIVE_VOTE_MS = 3 * 60 * 60 * 1000 // a vote older than 3h is stale
const RECENT_RESULT_MS = 90 * 60 * 1000 // show results decided in the last 90 min

/**
 * /c/:code — where people land after scanning the QR or entering the code.
 * If a vote is already running, they go straight in. Otherwise they wait here
 * (and show up on the host's screen) until the host starts the vote.
 */
export default function CrewHub() {
  return (
    <NameGate context="Joining lunch">
      <WaitingRoom />
    </NameGate>
  )
}

function WaitingRoom() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [crew, setCrew] = useState<CrewRow | null | undefined>(undefined)
  const [people, setPeople] = useState<PresentPerson[]>([])
  const [error, setError] = useState<string | null>(null)

  /** Checks for a running vote (or a fresh result) and jumps into it. */
  const check = useCallback(async () => {
    try {
      const c = await getCrewByCode(code.toUpperCase())
      setCrew(c)
      if (!c) return
      const [latest] = await listRounds(c.id, 1)
      if (!latest) return
      const age = Date.now() - new Date(latest.created_at).getTime()
      if ((latest.status === 'voting' && age < ACTIVE_VOTE_MS) || (latest.status === 'decided' && age < RECENT_RESULT_MS)) {
        navigate(`/r/${latest.id}`, { replace: true })
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }, [code, navigate])

  useEffect(() => {
    check()
  }, [check])

  // The moment the host starts the vote, everyone waiting gets moved into it.
  useEffect(() => (crew ? subscribeToCrew(crew.id, check) : undefined), [crew, check])

  // Show up on the host's screen while waiting.
  useEffect(() => {
    if (!crew) return
    return joinCrewPresence(crew.id, { clientId: getClientId(), name: getDisplayName(), host: false }, setPeople)
  }, [crew])

  if (crew === undefined && !error) return <FullPageLoader label="Finding the lunch…" />
  if (!crew)
    return (
      <Screen>
        <Notice
          icon={<SearchX className="size-7" />}
          title={error ? 'Couldn’t connect' : 'No lunch with that code'}
          body={error ?? <>Nothing matches <span className="font-mono text-cream">{code.toUpperCase()}</span>. Check the code with whoever invited you.</>}
          action={<Button onClick={() => (error ? check() : navigate('/'))}>{error ? 'Try again' : 'Back home'}</Button>}
        />
      </Screen>
    )

  const host = people.find((p) => p.host)
  const others = people.filter((p) => !p.host)

  return (
    <Screen>
      <div className="flex min-h-[65dvh] flex-col items-center justify-center text-center">
        {/* Pulsing rings around the code */}
        <div className="relative grid size-44 place-items-center">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border border-ember/40"
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 1.4, opacity: 0 }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
            />
          ))}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="glass grid size-32 place-items-center rounded-full"
          >
            <span className="font-mono text-2xl font-semibold tracking-[0.15em]">{crew.code}</span>
          </motion.div>
        </div>

        <h1 className="mt-8 font-display text-3xl font-extrabold tracking-tight">You’re in!</h1>
        <p className="mt-2 max-w-xs text-[15px] text-muted">
          {host ? `${host.name} is setting up lunch.` : 'The host is setting up lunch.'} The vote opens here automatically.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {others.map((p) => (
            <motion.span
              key={p.clientId}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="inline-flex items-center gap-2 rounded-full bg-cream/5 py-1 pr-3 pl-1 text-sm font-semibold ring-1 ring-cream/10"
            >
              <Avatar name={p.name} size="size-7" />
              {p.clientId === getClientId() ? `${p.name} (you)` : p.name}
            </motion.span>
          ))}
        </div>

        <p className="mt-12 text-xs text-dim">
          Actually setting it up yourself?{' '}
          <Link to={`/c/${crew.code}/new`} className="font-semibold text-muted underline-offset-2 hover:underline">
            Open lunch settings
          </Link>
        </p>
      </div>
    </Screen>
  )
}
