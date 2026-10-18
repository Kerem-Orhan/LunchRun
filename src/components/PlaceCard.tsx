import { motion } from 'motion/react'
import { Ban, Car, Coffee, Footprints, Sandwich, Store, UtensilsCrossed } from 'lucide-react'
import type { PlaceType } from '../lib/feasibility'
import type { PlaceRow } from '../lib/types'
import { StatusBadge } from './ui'

export const TYPE_ICON: Record<PlaceType, typeof Coffee> = {
  restaurant: UtensilsCrossed,
  fast_food: Sandwich,
  cafe: Coffee,
  food_court: Store,
}
export const TYPE_LABEL: Record<PlaceType, string> = {
  restaurant: 'Restaurant',
  fast_food: 'Fast food',
  cafe: 'Café',
  food_court: 'Food court',
}

interface PlaceCardProps {
  place: PlaceRow
  mode: 'walking' | 'driving'
  estimated?: boolean
  rank?: number | null // 1–3 when picked
  vetoed?: boolean
  highlighted?: boolean
  onPick?: () => void
  onVeto?: () => void
  index?: number
}

/**
 * One place on the ballot. Tap the card to rank it (1st → 2nd → 3rd),
 * tap "No way" to veto.
 */
export function PlaceCard({ place, mode, estimated, rank, vetoed, highlighted, onPick, onVeto, index = 0 }: PlaceCardProps) {
  const Icon = TYPE_ICON[place.type]
  const picked = rank != null

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index, 10) * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="list-none"
      id={`place-${place.id}`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-pressed={picked}
        onClick={onPick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onPick?.()
          }
        }}
        className={`glass group relative flex cursor-pointer gap-3.5 rounded-2xl p-3.5 transition-[transform,box-shadow,opacity] duration-300 active:scale-[0.985] ${
          picked ? 'shadow-[0_0_0_2px_var(--color-ember),0_20px_50px_-20px_var(--color-ember)]' : ''
        } ${highlighted && !picked ? 'shadow-[0_0_0_1.5px_rgb(246_239_231_/_0.45)]' : ''} ${vetoed ? 'opacity-55' : ''}`}
      >
        <div
          className={`grid size-12 shrink-0 place-items-center rounded-xl ring-1 transition-colors ${
            picked ? 'bg-ember text-ink ring-ember' : 'bg-cream/5 text-cream ring-cream/10'
          }`}
        >
          <Icon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className={`truncate font-display text-[17px] leading-tight font-bold ${vetoed ? 'line-through decoration-veto decoration-2' : ''}`}>
            {place.name}
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {TYPE_LABEL[place.type]}
            {place.cuisine ? ` · ${place.cuisine}` : ''}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={place.status} minutes={Number(place.total_minutes)} estimated={estimated} />
            <span className="inline-flex items-center gap-1 rounded-full bg-cream/5 px-2 py-1 text-xs font-semibold text-muted ring-1 ring-cream/10">
              {mode === 'walking' ? <Footprints className="size-3" /> : <Car className="size-3" />}
              {estimated ? '≈' : ''}
              {Math.round(Number(place.travel_minutes))} min
            </span>
            {place.diet_tags.map((d) => (
              <span
                key={d}
                title="From OpenStreetMap — double-check with the restaurant"
                className="rounded-full bg-plum/12 px-2 py-1 text-xs font-semibold text-[#b9a6ff] capitalize ring-1 ring-plum/25"
              >
                {d}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          <motion.span
            key={rank ?? 'none'}
            initial={picked ? { scale: 0.4, rotate: -30 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className={`grid size-9 place-items-center rounded-full font-display text-lg font-extrabold ${
              picked ? 'bg-ember text-ink' : 'border border-dashed border-cream/20 text-dim group-hover:text-muted'
            }`}
          >
            {picked ? rank : '+'}
          </motion.span>
          {onVeto && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onVeto()
              }}
              aria-pressed={vetoed}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold tracking-wide uppercase transition ${
                vetoed ? 'bg-veto text-ink' : 'text-dim hover:bg-veto/10 hover:text-veto'
              }`}
            >
              <Ban className="size-3" /> No way
            </button>
          )}
        </div>
      </div>
    </motion.li>
  )
}
