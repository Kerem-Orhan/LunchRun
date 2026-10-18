import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

/**
 * Temporary stand-in for screens built later this week (Lobby on Day 4,
 * Vote/Results on Day 5, History on Day 6). Shows the crew code so the
 * Home → crew flow can be clicked through today.
 */
export default function ComingSoon({ title, day }: { title: string; day: number }) {
  const { code } = useParams()

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      {code && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="glass mb-8 rounded-3xl px-8 py-6"
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">Crew code</p>
          <p className="mt-1 font-mono text-5xl font-semibold tracking-[0.18em] text-cream">{code}</p>
        </motion.div>
      )}
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted">This screen lands on Day {day}.</p>
      <Link to="/" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-ember hover:text-ember-soft">
        <ArrowLeft className="size-4" /> Back home
      </Link>
    </div>
  )
}
