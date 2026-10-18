import { Link } from 'react-router-dom'

/** Mark = a clock ring with the "time used" arc in ember, plus the wordmark. */
export function Logo() {
  return (
    <Link to="/" className="group inline-flex items-center gap-2.5" aria-label="LunchRun home">
      <svg viewBox="0 0 64 64" className="size-8 transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:rotate-[200deg]">
        <circle cx="32" cy="32" r="22" fill="none" stroke="var(--color-ink-3)" strokeWidth="7" />
        <path d="M32 10a22 22 0 0 1 19 33" fill="none" stroke="var(--color-ember)" strokeWidth="7" strokeLinecap="round" />
        <circle cx="32" cy="32" r="5" fill="var(--color-easy)" />
      </svg>
      <span className="font-display text-xl font-extrabold tracking-tight">
        Lunch<span className="text-ember">Run</span>
      </span>
    </Link>
  )
}
