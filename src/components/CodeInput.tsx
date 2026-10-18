import { motion } from 'motion/react'
import { useRef } from 'react'
import { CODE_LENGTH, normalizeCode } from '../lib/codes'

interface CodeInputProps {
  value: string
  onChange: (code: string) => void
  onComplete?: (code: string) => void
}

/**
 * One box per character. Typing auto-advances, Backspace steps back,
 * and pasting a full code (even "k7p-2q") fills every box at once.
 */
export function CodeInput({ value, onChange, onComplete }: CodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const chars = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? '')

  function update(next: string) {
    const code = normalizeCode(next)
    onChange(code)
    refs.current[Math.min(code.length, CODE_LENGTH - 1)]?.focus()
    if (code.length === CODE_LENGTH) onComplete?.(code)
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Crew code">
      {chars.map((char, i) => (
        <motion.input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={char}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          aria-label={`Character ${i + 1}`}
          maxLength={CODE_LENGTH}
          animate={char ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.25 }}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const typed = normalizeCode(e.target.value)
            if (!typed) return
            // Replace from this box onward with whatever was typed/pasted.
            update(value.slice(0, i) + typed)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault()
              const cut = char ? i : Math.max(0, i - 1)
              onChange(value.slice(0, cut))
              refs.current[cut]?.focus()
            }
          }}
          className={`aspect-[4/5] w-full min-w-0 rounded-xl bg-ink/60 text-center font-mono text-2xl font-semibold uppercase text-cream ring-1 transition focus:shadow-[0_0_0_4px_rgb(255_106_61_/_0.15)] focus:ring-ember focus:outline-none ${
            char ? 'ring-ember/50' : 'ring-cream/10'
          }`}
        />
      ))}
    </div>
  )
}
