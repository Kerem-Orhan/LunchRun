import { motion, type HTMLMotionProps } from 'motion/react'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'ghost'

const styles: Record<Variant, string> = {
  primary:
    'btn-shine bg-ember text-ink shadow-[0_10px_40px_-10px_var(--color-ember)] hover:shadow-[0_14px_50px_-8px_var(--color-ember)] disabled:bg-ink-3 disabled:text-dim disabled:shadow-none',
  ghost: 'bg-cream/5 text-cream ring-1 ring-cream/10 hover:bg-cream/10',
}

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant
  children: ReactNode
}

/** Pill button with a springy press and (for primary) a light sweep on hover. */
export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  return (
    <motion.button
      whileTap={rest.disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl px-6 font-display text-[17px] font-bold tracking-tight transition-[background,box-shadow,color] duration-300 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
