import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { getDisplayName, setDisplayName } from '../lib/identity'
import { Button } from './Button'
import { TextField } from './TextField'

/**
 * People who open a shared link haven't picked a name yet.
 * This asks once (saved in localStorage), then shows the real screen.
 */
export function NameGate({ children, context }: { children: ReactNode; context?: string }) {
  const [name, setName] = useState(getDisplayName)
  const [draft, setDraft] = useState('')

  if (name) return <>{children}</>

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    setDisplayName(draft)
    setName(getDisplayName() || draft.trim()) // fallback if storage is blocked
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-sm items-center px-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass w-full rounded-3xl p-6"
      >
        <p className="text-xs font-semibold tracking-[0.18em] text-ember uppercase">{context ?? 'Joining a crew'}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">What’s your name?</h1>
        <p className="mt-1 mb-5 text-[15px] text-muted">So your crew knows who voted. No account needed.</p>
        <TextField
          id="gate-name"
          label="Your name"
          autoFocus
          maxLength={24}
          autoComplete="nickname"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Sam"
        />
        <Button type="submit" className="mt-5" disabled={!draft.trim()}>
          Continue <ArrowRight className="size-5" />
        </Button>
      </motion.form>
    </div>
  )
}
