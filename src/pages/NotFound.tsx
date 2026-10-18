import { Compass } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Notice, Screen } from '../components/ui'

/** 404 page. */
export default function NotFound() {
  const navigate = useNavigate()
  return (
    <Screen>
      <Notice
        icon={<Compass className="size-7" />}
        title="Wrong turn"
        body="This page doesn’t exist. Maybe the link got cut off?"
        action={<Button onClick={() => navigate('/')}>Back home</Button>}
      />
    </Screen>
  )
}
