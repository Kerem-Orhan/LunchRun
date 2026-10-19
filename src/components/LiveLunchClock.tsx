import { motion } from 'motion/react'
import { useEffect, useState } from 'react'

export interface LiveSegment {
  label: string // "Drive there", "Eat", ...
  minutes: number
  color: string
}

interface LiveLunchClockProps {
  startsAt: Date // first bell
  endsAt: Date // last bell
  /** The trip in order. It's planned to finish exactly at the bell (leave at the "Leave by" time). */
  segments: LiveSegment[]
  tone: 'easy' | 'tight'
}

const SIZE = 260
const STROKE = 18
const R = (SIZE - STROKE) / 2
const C = 2 * Math.PI * R
const GAP = 5 // px between arcs

/** Re-renders every `ms` so countdowns tick. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** 754 seconds → "12:34"; over an hour → "1:02:03". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** Where we are in lunch right now: before it, waiting to leave, in a trip segment, or over. */
export function currentPhase(now: number, startsAt: Date, endsAt: Date, segments: LiveSegment[]) {
  const end = endsAt.getTime()
  const total = segments.reduce((sum, s) => sum + s.minutes, 0)
  const leaveAt = end - total * 60_000

  if (now < startsAt.getTime()) return { kind: 'before' as const, secondsLeft: (startsAt.getTime() - now) / 1000, index: -1 }
  if (now >= end) return { kind: 'over' as const, secondsLeft: 0, index: -1 }
  if (now < leaveAt) return { kind: 'free' as const, secondsLeft: (leaveAt - now) / 1000, index: -1 }

  let cursor = leaveAt
  for (let i = 0; i < segments.length; i++) {
    const segEnd = cursor + segments[i].minutes * 60_000
    if (now < segEnd) return { kind: 'segment' as const, secondsLeft: (segEnd - now) / 1000, index: i }
    cursor = segEnd
  }
  return { kind: 'over' as const, secondsLeft: 0, index: -1 }
}

/**
 * A real clock for the lunch period. The full ring is bell-to-bell; the colored
 * arcs are the trip, ending at the bell. A bright marker moves with the actual
 * time, everything behind it dims, and the center counts down the current step.
 */
export function LiveLunchClock({ startsAt, endsAt, segments, tone }: LiveLunchClockProps) {
  const now = useNow(1000)
  const lunchMs = endsAt.getTime() - startsAt.getTime()
  const lunchMin = lunchMs / 60_000
  const total = segments.reduce((sum, s) => sum + s.minutes, 0)
  const phase = currentPhase(now, startsAt, endsAt, segments)

  // Fraction of the lunch period that has passed (0 → 1), for the marker + dimming.
  const progress = Math.min(1, Math.max(0, (now - startsAt.getTime()) / lunchMs))

  // Arcs, positioned on the bell-to-bell ring.
  let cursor = (lunchMin - total) / lunchMin // trip starts at the leave-by time
  const arcs = segments.map((s) => {
    const start = cursor
    const length = s.minutes / lunchMin
    cursor += length
    return { ...s, start, length }
  })

  const bellSeconds = (endsAt.getTime() - now) / 1000
  const markerAngle = progress * 2 * Math.PI - Math.PI / 2

  let big: string
  let label: string
  if (phase.kind === 'before') {
    big = formatCountdown(phase.secondsLeft)
    label = 'until lunch starts'
  } else if (phase.kind === 'free') {
    big = formatCountdown(phase.secondsLeft)
    label = 'until you leave'
  } else if (phase.kind === 'segment') {
    big = formatCountdown(phase.secondsLeft)
    const step = segments[phase.index].label
    label = step === 'Buffer' ? 'of buffer before the bell' : `left to ${step.toLowerCase()}`
  } else {
    big = 'Done'
    label = 'lunch is over'
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px]">
      <div className={`absolute inset-[18%] rounded-full blur-3xl ${tone === 'easy' ? 'bg-easy/15' : 'bg-tight/15'}`} />

      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative size-full -rotate-90" aria-hidden>
        {/* Minute ticks */}
        {Array.from({ length: Math.round(lunchMin) }, (_, i) => {
          const a = (i / lunchMin) * 2 * Math.PI
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
              strokeOpacity={i / lunchMin < progress ? 0.06 : major ? 0.3 : 0.12}
              strokeWidth={major ? 1.6 : 1}
              strokeLinecap="round"
            />
          )
        })}

        {/* Track = free time before you need to leave */}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--color-ink-3)" strokeWidth={STROKE} />

        {/* Trip segments */}
        {arcs.map((arc, i) => {
          const active = phase.kind === 'segment' && phase.index === i
          return (
            <motion.circle
              key={arc.label}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={arc.color}
              strokeWidth={active ? STROKE + 4 : STROKE}
              strokeLinecap="round"
              strokeDasharray={`${Math.max(arc.length * C - GAP, 0.01)} ${C}`}
              strokeDashoffset={-arc.start * C - GAP / 2}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.12, duration: 0.5 }}
              style={active ? { filter: `drop-shadow(0 0 8px ${arc.color})` } : undefined}
            />
          )
        })}

        {/* Time already passed: a dark veil over the ring */}
        {progress > 0 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="var(--color-ink)"
            strokeOpacity={0.7}
            strokeWidth={STROKE + 6}
            strokeDasharray={`${progress * C} ${C}`}
          />
        )}
      </svg>

      {/* "Now" marker */}
      {phase.kind !== 'before' && phase.kind !== 'over' && (
        <div
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream shadow-[0_0_16px_4px_rgb(246_239_231_/_0.7)] ring-4 ring-ink transition-[left,top] duration-1000 ease-linear"
          style={{
            left: `${50 + (R / SIZE) * 100 * Math.cos(markerAngle)}%`,
            top: `${50 + (R / SIZE) * 100 * Math.sin(markerAngle)}%`,
          }}
        />
      )}

      {/* Center readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-5xl font-semibold tracking-tight tabular-nums">{big}</span>
        <span className="mt-1 text-[13px] font-medium text-muted">{label}</span>
        {phase.kind !== 'over' && (
          <span className="mt-3 rounded-full bg-cream/5 px-3 py-1 font-mono text-xs font-semibold text-muted tabular-nums ring-1 ring-cream/10">
            bell in {formatCountdown(bellSeconds)}
          </span>
        )}
      </div>
    </div>
  )
}
