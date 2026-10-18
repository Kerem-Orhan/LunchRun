/** Small shared UI pieces used across screens. */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, Copy, Share2 } from 'lucide-react'
import QR from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export const EASE = [0.16, 1, 0.3, 1] as const

/** Page wrapper with consistent width and gutters. */
export function Screen({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto w-full px-4 pt-2 pb-32 sm:px-6 ${wide ? 'max-w-6xl' : 'max-w-xl'}`}>{children}</div>
}

/** Back link + big title + optional eyebrow and right-side slot. */
export function ScreenHeader({ back, eyebrow, title, right }: { back?: string; eyebrow?: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6">
      {back && (
        <Link to={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-cream">
          <ArrowLeft className="size-4" /> Back
        </Link>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-semibold tracking-[0.18em] text-ember uppercase">{eyebrow}</p>}
          <h1 className="font-display text-[clamp(2rem,7vw,2.75rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-balance">{title}</h1>
        </div>
        {right}
      </div>
    </div>
  )
}

/** Spinning partial ring — the logo mark, in motion. */
export function Spinner({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 50 50" className={`animate-spin ${className}`} style={{ animationDuration: '0.9s' }} aria-hidden>
      <circle cx="25" cy="25" r="20" fill="none" stroke="var(--color-ink-3)" strokeWidth="5" />
      <path d="M25 5a20 20 0 0 1 20 20" fill="none" stroke="var(--color-ember)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

export function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-muted">
      <Spinner className="size-10" />
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-sm font-medium">
        {label}
      </motion.p>
    </div>
  )
}

/** Friendly full-width message for errors and empty states. */
export function Notice({ icon, title, body, action }: { icon: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="glass flex flex-col items-center rounded-3xl px-6 py-10 text-center"
    >
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-ember/10 text-ember ring-1 ring-ember/20">{icon}</div>
      <h2 className="font-display text-2xl font-extrabold tracking-tight">{title}</h2>
      <div className="mt-2 max-w-sm text-[15px] text-muted">{body}</div>
      {action && <div className="mt-6 w-full max-w-xs">{action}</div>}
    </motion.div>
  )
}

export function StatusBadge({ status, minutes, estimated }: { status: 'easy' | 'tight'; minutes?: number; estimated?: boolean }) {
  const easy = status === 'easy'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${
        easy ? 'bg-easy/12 text-easy ring-easy/25' : 'bg-tight/12 text-tight ring-tight/25'
      }`}
    >
      <span className={`size-1.5 rounded-full ${easy ? 'bg-easy' : 'bg-tight'}`} />
      {easy ? 'Easy' : 'Tight'}
      {minutes != null && (
        <span className="font-semibold opacity-80 tabular-nums">
          · {estimated ? '≈' : ''}
          {Math.round(minutes)} min
        </span>
      )}
    </span>
  )
}

/** Segmented control with a sliding pill (shared layoutId per group). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  group,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  group: string
}) {
  return (
    <div
      className="relative grid rounded-2xl bg-ink/70 p-1 ring-1 ring-cream/5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="radiogroup"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 flex h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors ${
            value === o.value ? 'text-ink' : 'text-muted hover:text-cream'
          }`}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${group}`}
              className="absolute inset-0 -z-10 rounded-xl bg-cream"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Branded QR code (cream on ink) for a URL. */
export function QRCode({ value, className = '' }: { value: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    QR.toDataURL(value, { margin: 1, width: 480, errorCorrectionLevel: 'M', color: { dark: '#0e0c0b', light: '#f6efe7' } })
      .then(setSrc)
      .catch(() => setSrc(null))
  }, [value])
  return (
    <div className={`aspect-square overflow-hidden rounded-2xl bg-cream p-2 ${className}`}>
      {src ? <img src={src} alt="QR code to join" className="size-full [image-rendering:pixelated]" /> : <div className="size-full animate-pulse rounded-xl bg-ink/10" />}
    </div>
  )
}

/** Share sheet on phones (navigator.share), copy-to-clipboard elsewhere. */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  async function share() {
    if (canShare) {
      try {
        await navigator.share({ title, text: `Join "${title}" on LunchRun`, url })
        return
      } catch {
        /* user closed the share sheet — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={share}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cream/5 px-4 text-sm font-semibold text-cream ring-1 ring-cream/10 transition hover:bg-cream/10"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? 'done' : 'idle'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="inline-flex items-center gap-2"
        >
          {copied ? <Check className="size-4 text-easy" /> : canShare ? <Share2 className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Link copied' : canShare ? 'Share link' : 'Copy link'}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

/** Colored initial bubble for a member. Color is derived from the name so it's stable. */
const AVATAR_COLORS = ['#ff6a3d', '#c6f36b', '#ffc94d', '#8b6cff', '#ff9a6b', '#6be0f3', '#ff6bb5']
export function Avatar({ name, size = 'size-9', ring }: { name: string; size?: string; ring?: string }) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const color = AVATAR_COLORS[h % AVATAR_COLORS.length]
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-display text-sm font-extrabold text-ink ring-2 ${ring ?? 'ring-ink'} ${size}`}
      style={{ background: color }}
      title={name}
    >
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  )
}
