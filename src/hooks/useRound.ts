import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getCrew, getRound, listMembers, listPlaces, listVisits, listVotes, subscribeToRound, type RoundTable } from '../lib/db'
import { getClientId } from '../lib/identity'
import { scoreRound } from '../lib/round'
import type { CrewRow, MemberRow, PlaceRow, RoundRow, VisitRow, VoteRow } from '../lib/types'

interface RoundState {
  crew: CrewRow | null
  round: RoundRow | null
  places: PlaceRow[]
  members: MemberRow[]
  votes: VoteRow[]
  visits: VisitRow[]
}

const EMPTY: RoundState = { crew: null, round: null, places: [], members: [], votes: [], visits: [] }

/**
 * Loads everything about one round and keeps it live: whenever any phone
 * changes a table, we re-fetch just that table. Simple and hard to get wrong.
 */
export function useRound(roundId: string | undefined) {
  const [state, setState] = useState<RoundState>(EMPTY)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const crewIdRef = useRef<string | null>(null)

  const refetch = useCallback(
    async (table: RoundTable | 'all') => {
      if (!roundId) return
      try {
        if (table === 'all' || table === 'rounds') {
          const round = await getRound(roundId)
          if (!round) return setStatus('missing')
          crewIdRef.current = round.crew_id
          setState((s) => ({ ...s, round }))
          // Fetch crew + history once, and again when the round is decided (a visit was added).
          if (table === 'all' || round.status === 'decided') {
            const [crew, visits] = await Promise.all([getCrew(round.crew_id), listVisits(round.crew_id)])
            setState((s) => ({ ...s, crew, visits }))
          }
        }
        if (table === 'all' || table === 'places') {
          const places = await listPlaces(roundId)
          setState((s) => ({ ...s, places }))
        }
        if (table === 'all' || table === 'members') {
          const members = await listMembers(roundId)
          setState((s) => ({ ...s, members }))
        }
        if (table === 'all' || table === 'votes') {
          const votes = await listVotes(roundId)
          setState((s) => ({ ...s, votes }))
        }
        setStatus((s) => (s === 'missing' ? s : 'ready'))
      } catch (e) {
        setError((e as Error).message)
        setStatus((s) => (s === 'ready' ? s : 'error'))
      }
    },
    [roundId],
  )

  useEffect(() => {
    setState(EMPTY)
    setStatus('loading')
    refetch('all')
    if (!roundId) return
    const unsubscribe = subscribeToRound(roundId, (table) => refetch(table))
    // Phones sleep and drop realtime connections; catch up when the tab comes back.
    const onVisible = () => document.visibilityState === 'visible' && refetch('all')
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [roundId, refetch])

  const clientId = getClientId()
  const me = state.members.find((m) => m.client_id === clientId) ?? null
  const myVote = me ? (state.votes.find((v) => v.member_id === me.id) ?? null) : null
  const isCreator = state.round?.creator_client_id === clientId

  const result = useMemo(
    () => (state.round ? scoreRound(state.round, state.places, state.votes, state.members, state.visits) : null),
    [state.round, state.places, state.votes, state.members, state.visits],
  )

  return { ...state, status, error, me, myVote, isCreator, result, refetch }
}
