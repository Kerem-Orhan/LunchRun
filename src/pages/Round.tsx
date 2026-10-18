import { SearchX, WifiOff } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { NameGate } from '../components/NameGate'
import { ResultsView } from '../components/ResultsView'
import { FullPageLoader, Notice, Screen } from '../components/ui'
import { VoteView } from '../components/VoteView'
import { useRound } from '../hooks/useRound'
import { joinRound } from '../lib/db'
import { getClientId, getDisplayName, rememberCrew } from '../lib/identity'

/** /r/:roundId — the live lobby + ballot while voting, then the results. */
export default function Round() {
  return (
    <NameGate context="Joining lunch">
      <RoundInner />
    </NameGate>
  )
}

function RoundInner() {
  const { roundId } = useParams()
  const navigate = useNavigate()
  const data = useRound(roundId)
  const { round, crew, me, status } = data
  const joining = useRef(false)

  // Opening the page = joining the round (once per device).
  useEffect(() => {
    if (status !== 'ready' || !round || me || joining.current || round.status !== 'voting') return
    joining.current = true
    joinRound(round.id, getDisplayName(), getClientId())
      .then(() => data.refetch('members'))
      .catch(() => (joining.current = false))
  }, [status, round, me, data])

  useEffect(() => {
    if (crew) rememberCrew(crew.code, crew.name)
  }, [crew])

  if (status === 'loading') return <FullPageLoader label="Loading lunch…" />
  if (status === 'missing')
    return (
      <Screen>
        <Notice icon={<SearchX className="size-7" />} title="This lunch doesn’t exist" body="The link may be broken or old." action={<Button onClick={() => navigate('/')}>Back home</Button>} />
      </Screen>
    )
  if (status === 'error' || !round)
    return (
      <Screen>
        <Notice icon={<WifiOff className="size-7" />} title="Couldn’t load this lunch" body={data.error ?? 'Check your connection.'} action={<Button onClick={() => data.refetch('all')}>Try again</Button>} />
      </Screen>
    )

  return round.status === 'voting' ? <VoteView data={data} /> : <ResultsView data={data} />
}
