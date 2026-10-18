import type { InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

/** Label + input with a soft ember glow on focus. */
export function TextField({ label, id, className = '', ...rest }: TextFieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      <input
        id={id}
        className={`h-12 w-full rounded-xl bg-ink/60 px-4 text-[16px] text-cream ring-1 ring-cream/10 transition placeholder:text-dim focus:bg-ink/80 focus:shadow-[0_0_0_4px_rgb(255_106_61_/_0.15)] focus:ring-ember/70 focus:outline-none ${className}`}
        {...rest}
      />
    </label>
  )
}
