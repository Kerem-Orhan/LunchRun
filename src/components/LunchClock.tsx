import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef } from 'react'

export interface ClockSegment {
  label: string
  minutes: number
  color: string
}

interface LunchClockProps {
  lunchMinutes: number
  segments: ClockSegment[]
  /** Optional caption under the big number, e.g. "Easy · 4 min spare". */
  caption?: string
  captionTone?: 'easy' | 'tight'
}

const SIZE = 240
const STROKE = 18
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R
const GAP = 6 // px gap between segments on the ring

/**
 * The lunch period drawn as a ring: each segment (travel, wait, eat, ...)
 * is an arc sized by its minutes. Arcs draw in one after another, and the
 * total counts up in the middle. Leftover time stays as the dark track.
 */
export function LunchClock({ lunchMinutes, segments, caption, captionTone = 'easy' }: LunchClockProps) {
  const used = segments.reduce((sum, s) => sum + s.minutes, 0)

  // Start the animation only once the ring scrolls into view (it's below the fold on phones).
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })

  // Count-up number in the center.
  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) => Math.round(v))
  useEffect(() => {
    if (!inView) return
    const controls = animate(count, used, { duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 })
    return () => controls.stop()
  }, [count, used, inView])

  // Precompute where each arc starts (as a fraction of the full circle).
  let cursor = 0
  const arcs = segments.map((s) => {
    const start = cursor / lunchMinutes
    const length = s.minutes / lunchMinutes
    cursor += s.minutes
    return { ...s, start, length }
  })

  return (
    <div ref={ref} className="relative mx-auto aspect-square w-full max-w-[280px]">
      {/* Soft glow under the ring */}
      <div className="absolute inset-[18%] rounded-full bg-ember/25 blur-3xl" />

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative size-full -rotate-90">
        {/* Minute ticks around the outside */}
        {Array.from({ length: lunchMinutes }, (_, i) => {
          const a = (i / lunchMinutes) * 2 * Math.PI
          const major = i % 5 === 0
          const r1 = R - STROKE / 2 - 6
          const r2 = r1 - (major ? 7 : 3)
          return (
            <line
              key={i}
              x1={SIZE / 2 + r1 * Math.cos(a)}
              y1={SIZE / 2 + r1 * Math.sin(a)}
              x2={SIZE / 2 + r2 * Math.cos(a)}
              y2={SIZE / 2 + r2 * Math.sin(a)}
              stroke="var(--color-cream)"
              strokeOpacity={major ? 0.28 : 0.1}
              strokeWidth={major ? 1.6 : 1}
              strokeLinecap="round"
            />
          )
        })}

        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--color-ink-3)" strokeWidth={STROKE} />

        {arcs.map((arc, i) => {
          const dash = Math.max(arc.length * C - GAP, 0.01)
          return (
            <motion.circle
              key={arc.label}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDashoffset={-arc.start * C - GAP / 2}
              initial={{ strokeDasharray: `0 ${C}`, opacity: 0 }}
              animate={inView ? { strokeDasharray: `${dash} ${C}`, opacity: 1 } : undefined}
              transition={{ duration: 0.7, delay: 0.35 + i * 0.22, ease: [0.16, 1, 0.3, 1] }}
            />
          )
        })}
      </svg>

      {/* "Now" marker slowly orbiting — a hint that the clock is ticking. */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      >
        <div className="absolute top-[1.5%] left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-cream shadow-[0_0_14px_3px_rgb(246_239_231_/_0.6)]" />
      </motion.div>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="flex items-baseline gap-1">
          <motion.span className="font-display text-6xl font-extrabold tabular-nums tracking-tighter">{rounded}</motion.span>
          <span className="font-display text-lg font-bold text-muted">/{lunchMinutes}</span>
        </div>
        <span className="text-[13px] font-medium tracking-wide text-muted uppercase">minutes</span>
        {caption && (
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{ delay: 1.8 }}
            className={`mt-3 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
              captionTone === 'easy' ? 'bg-easy/12 text-easy ring-easy/25' : 'bg-tight/12 text-tight ring-tight/25'
            }`}
          >
            {caption}
          </motion.span>
        )}
      </div>
    </div>
  )
}
