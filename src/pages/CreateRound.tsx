import { AnimatePresence, motion } from 'motion/react'
import { Car, ChevronDown, Crosshair, Footprints, MapPin, Minus, Plus, RotateCw, Search, SearchX, Sparkles, Utensils } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { MapView } from '../components/MapView'
import { NameGate } from '../components/NameGate'
import { Avatar, EASE, FullPageLoader, Notice, QRCode, Screen, ScreenHeader, Segmented, ShareButton, Spinner } from '../components/ui'
import { BALLOT_SIZE, createRound, getCrewByCode, joinCrewPresence, type PresentPerson } from '../lib/db'
import { DEFAULT_BUFFER_MINUTES, DEFAULT_EAT_MINUTES, PREFILTER_RADIUS_METERS, type LatLng, type RoundRules, type TravelMode } from '../lib/feasibility'
import { getCurrentPosition, searchAddress, type GeoResult } from '../lib/geocode'
import { getClientId, getDisplayName } from '../lib/identity'
import { fetchNearbyPlaces, type OsmPlace } from '../lib/overpass'
import { rankReachable } from '../lib/places'
import { fetchTravelMinutes } from '../lib/routing'
import type { CrewRow } from '../lib/types'

const LENGTHS = [25, 30, 35, 40, 45, 50, 60]
const LAST_START_KEY = 'lunchrun:last-start'

interface StartPoint extends LatLng {
  label: string
}

/** "HH:MM" for now, rounded down to 5 minutes — the default lunch start. */
function nowHHMM() {
  const d = new Date()
  d.setMinutes(Math.floor(d.getMinutes() / 5) * 5)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function todayAt(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

function loadLastStart(): StartPoint | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_START_KEY) ?? 'null')
    return v && typeof v.lat === 'number' ? v : null
  } catch {
    return null
  }
}

export default function CreateRound() {
  return (
    <NameGate context="Starting a lunch">
      <CreateRoundInner />
    </NameGate>
  )
}

function CreateRoundInner() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [crew, setCrew] = useState<CrewRow | null | undefined>(undefined)

  // ---- Rules ----
  const [start, setStart] = useState<StartPoint | null>(loadLastStart)
  const [lunchMinutes, setLunchMinutes] = useState(35)
  const [customLength, setCustomLength] = useState(false)
  const [startsAt, setStartsAt] = useState(nowHHMM)
  const [mode, setMode] = useState<TravelMode>('driving')
  const [eatMinutes, setEatMinutes] = useState(DEFAULT_EAT_MINUTES)
  const [bufferMinutes, setBufferMinutes] = useState(DEFAULT_BUFFER_MINUTES)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // ---- Search results (raw places + travel times, refetched only when start/mode change) ----
  const [nearby, setNearby] = useState<{ key: string; places: OsmPlace[]; minutes: (number | null)[]; estimated: boolean } | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    getCrewByCode(code.toUpperCase())
      .then(setCrew)
      .catch(() => setCrew(null))
  }, [code])

  const searchKey = start ? `${start.lat.toFixed(5)},${start.lng.toFixed(5)}|${mode}` : null

  const runSearch = useCallback(
    async (signal?: AbortSignal) => {
      if (!start || !searchKey) return
      setSearching(true)
      setSearchError(null)
      try {
        const places = await fetchNearbyPlaces(start, mode, signal)
        const { minutes, estimated } = await fetchTravelMinutes(mode, start, places, signal)
        setNearby({ key: searchKey, places, minutes, estimated })
      } catch (e) {
        if (!signal?.aborted) setSearchError((e as Error).message)
      } finally {
        if (!signal?.aborted) setSearching(false)
      }
    },
    [start, mode, searchKey],
  )

  // Re-search whenever the start point or travel mode changes.
  useEffect(() => {
    if (!searchKey) return
    const ctrl = new AbortController()
    runSearch(ctrl.signal)
    return () => ctrl.abort()
  }, [searchKey, runSearch])

  const rules: RoundRules = { lunchMinutes, mode, eatMinutes, bufferMinutes }

  // Lunch length / eat / buffer changes re-filter instantly, without new network calls.
  const reachable = useMemo(
    () => (nearby && nearby.key === searchKey ? rankReachable(nearby.places, nearby.minutes, rules) : []),
    [nearby, searchKey, lunchMinutes, mode, eatMinutes, bufferMinutes],
  )
  const ready = !!nearby && nearby.key === searchKey && !searching
  const easyCount = reachable.filter((p) => p.feasibility.status === 'easy').length
  const ballot = reachable.slice(0, BALLOT_SIZE)

  async function startVoting() {
    if (!crew || !start || ballot.length === 0) return
    setCreating(true)
    setCreateError(null)
    try {
      const round = await createRound({
        crewId: crew.id,
        start,
        rules,
        lunchStartsAt: todayAt(startsAt),
        creatorClientId: getClientId(),
        estimated: nearby?.estimated ?? false,
        places: ballot,
      })
      navigate(`/r/${round.id}`)
    } catch (e) {
      setCreateError((e as Error).message)
      setCreating(false)
    }
  }

  function chooseStart(p: StartPoint) {
    setStart(p)
    try {
      localStorage.setItem(LAST_START_KEY, JSON.stringify(p))
    } catch {
      /* not critical */
    }
  }

  if (crew === undefined) return <FullPageLoader label="Loading…" />
  if (crew === null)
    return (
      <Screen>
        <Notice icon={<SearchX className="size-7" />} title="Lunch not found" body="This link doesn’t match a lunch code." action={<Button onClick={() => navigate('/')}>Back home</Button>} />
      </Screen>
    )

  return (
    <Screen wide>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-8">
        {/* ---------- Left: the rules ---------- */}
        <div>
          <ScreenHeader back="/" eyebrow="You’re the host" title="Today’s lunch" />

          <InviteCard code={crew.code} crewId={crew.id} />

          <Section n={1} title="Where are you leaving from?">
            <LocationPicker value={start} onChange={chooseStart} />
          </Section>

          <Section n={2} title="How long is lunch?">
            <div className="grid grid-cols-4 gap-2">
              {LENGTHS.map((m) => (
                <Chip key={m} active={!customLength && lunchMinutes === m} onClick={() => (setCustomLength(false), setLunchMinutes(m))}>
                  {m}
                  <span className="text-[11px] opacity-70">m</span>
                </Chip>
              ))}
              <Chip active={customLength} onClick={() => setCustomLength(true)}>
                Custom
              </Chip>
            </div>
            <AnimatePresence initial={false}>
              {customLength && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pt-3">
                    <Stepper label="Lunch length" value={lunchMinutes} min={10} max={120} step={5} onChange={setLunchMinutes} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <label className="mt-3 flex items-center justify-between rounded-xl bg-ink/60 px-4 py-2.5 ring-1 ring-cream/10">
              <span className="text-sm text-muted">Lunch starts at</span>
              <input
                type="time"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="bg-transparent text-right font-mono text-[15px] font-semibold text-cream [color-scheme:dark] focus:outline-none"
              />
            </label>
          </Section>

          <Section n={3} title="How are you getting there?">
            <Segmented
              group="mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'walking', label: <><Footprints className="size-4" /> Walking</> },
                { value: 'driving', label: <><Car className="size-4" /> Driving</> },
              ]}
            />
          </Section>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="mt-1 flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm font-semibold text-muted transition hover:text-cream"
            aria-expanded={showAdvanced}
          >
            Advanced · eat {eatMinutes}m · buffer {bufferMinutes}m
            <ChevronDown className={`size-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {showAdvanced && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid gap-2 pt-2 pb-2">
                  <Stepper label="Time to eat" value={eatMinutes} min={5} max={45} step={1} onChange={setEatMinutes} />
                  <Stepper label="Safety buffer" value={bufferMinutes} min={0} max={15} step={1} onChange={setBufferMinutes} />
                  <p className="px-1 text-xs text-dim">Ordering time is set by place type: fast food & cafés 5m, food courts 8m, sit-down 15m. Driving adds 3m to park.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ---------- Right: live preview ---------- */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Preview
            start={start}
            mode={mode}
            reachable={reachable}
            ready={ready}
            searching={searching}
            error={searchError}
            estimated={!!nearby?.estimated}
            nearbyCount={nearby?.key === searchKey ? nearby.places.length : 0}
            easyCount={easyCount}
            onRetry={() => runSearch()}
          />
        </div>
      </div>

      {/* ---------- Sticky action bar ---------- */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-ink via-ink/90 to-transparent px-4 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto max-w-xl">
          {createError && <p className="mb-2 rounded-xl bg-veto/10 px-3 py-2 text-center text-sm text-veto ring-1 ring-veto/25">{createError}</p>}
          <Button onClick={startVoting} disabled={!ready || ballot.length === 0 || creating}>
            {creating ? (
              <Spinner className="size-5" />
            ) : !start ? (
              'Pick a starting point'
            ) : !ready ? (
              'Finding spots…'
            ) : ballot.length === 0 ? (
              'Nothing fits — adjust above'
            ) : (
              <>
                <Sparkles className="size-5" /> Start voting · {ballot.length} {ballot.length === 1 ? 'spot' : 'spots'}
              </>
            )}
          </Button>
        </div>
      </div>
    </Screen>
  )
}

// ---------------------------------------------------------------------------

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: n * 0.06, ease: EASE }} className="mb-6">
      <h2 className="mb-2.5 flex items-center gap-2.5 font-display text-[17px] font-bold">
        <span className="grid size-6 place-items-center rounded-full bg-ember/15 font-mono text-xs text-ember ring-1 ring-ember/30">{n}</span>
        {title}
      </h2>
      {children}
    </motion.section>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-12 items-baseline justify-center gap-0.5 rounded-xl pt-3 font-display text-lg font-bold transition-colors ${
        active ? 'bg-cream text-ink shadow-[0_8px_30px_-10px_rgb(246_239_231_/_0.5)]' : 'bg-ink/60 text-cream ring-1 ring-cream/10 hover:ring-cream/25'
      } ${typeof children === 'string' ? 'text-[15px]' : ''}`}
    >
      {children}
    </motion.button>
  )
}

function Stepper({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)))
  return (
    <div className="flex items-center justify-between rounded-xl bg-ink/60 px-4 py-2 ring-1 ring-cream/10">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => set(value - step)} disabled={value <= min} aria-label={`Less ${label}`} className="grid size-8 place-items-center rounded-lg bg-cream/5 text-cream transition hover:bg-cream/10 disabled:opacity-30">
          <Minus className="size-4" />
        </button>
        <span className="w-14 text-center font-mono text-[15px] font-semibold tabular-nums">{value} min</span>
        <button type="button" onClick={() => set(value + step)} disabled={value >= max} aria-label={`More ${label}`} className="grid size-8 place-items-center rounded-lg bg-cream/5 text-cream transition hover:bg-cream/10 disabled:opacity-30">
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}

/** "Use my location" + debounced address search. */
function LocationPicker({ value, onChange }: { value: StartPoint | null; onChange: (p: StartPoint) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce typing by ~700ms (Nominatim allows 1 request/second).
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        setResults(await searchAddress(query, value, ctrl.signal))
        setError(null)
      } catch (e) {
        if (!ctrl.signal.aborted) setError((e as Error).message)
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 700)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  async function locate() {
    setLocating(true)
    setError(null)
    try {
      const p = await getCurrentPosition()
      onChange({ ...p, label: 'Your current location' })
      setQuery('')
      setResults([])
    } catch (e) {
      setError((e as Error).message)
      inputRef.current?.focus()
    } finally {
      setLocating(false)
    }
  }

  return (
    <div>
      {value && (
        <motion.div layout className="mb-2.5 flex items-center gap-3 rounded-xl bg-ember/10 px-3.5 py-2.5 ring-1 ring-ember/30">
          <MapPin className="size-4 shrink-0 text-ember" />
          <span className="truncate text-sm font-semibold">{value.label}</span>
        </motion.div>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={locate}
          disabled={locating}
          className="flex h-12 items-center gap-2 rounded-xl bg-cream px-4 text-sm font-bold text-ink transition hover:bg-white disabled:opacity-60"
        >
          {locating ? <Spinner className="size-4" /> : <Crosshair className="size-4" />}
          <span className="hidden sm:inline">Use my location</span>
          <span className="sm:hidden">Locate</span>
        </motion.button>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search school or address"
            className="h-12 w-full rounded-xl bg-ink/60 pr-9 pl-10 text-[16px] text-cream ring-1 ring-cream/10 transition placeholder:text-dim focus:shadow-[0_0_0_4px_rgb(255_106_61_/_0.15)] focus:ring-ember/70 focus:outline-none"
          />
          {loading && <Spinner className="absolute top-1/2 right-3 size-4 -translate-y-1/2" />}
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-tight">{error}</p>}

      <AnimatePresence>
        {results.length > 0 && (
          <motion.ul initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="glass mt-2 overflow-hidden rounded-xl">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ lat: r.lat, lng: r.lng, label: r.title })
                    setQuery('')
                    setResults([])
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-cream/5"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-dim" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{r.title}</span>
                    <span className="block truncate text-xs text-dim">{r.subtitle}</span>
                  </span>
                </button>
              </li>
            ))}
            <li className="px-4 py-1.5 text-[10px] text-dim">Search by OpenStreetMap Nominatim</li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Map + counts that update live as the rules change. */
function Preview({
  start,
  mode,
  reachable,
  ready,
  searching,
  error,
  estimated,
  nearbyCount,
  easyCount,
  onRetry,
}: {
  start: StartPoint | null
  mode: TravelMode
  reachable: ReturnType<typeof rankReachable>
  ready: boolean
  searching: boolean
  error: string | null
  estimated: boolean
  nearbyCount: number
  easyCount: number
  onRetry: () => void
}) {
  if (!start) {
    return (
      <div className="glass grid aspect-[4/3] place-items-center rounded-3xl p-8 text-center lg:aspect-auto lg:h-[70vh]">
        <div>
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-ember/10 text-ember ring-1 ring-ember/20">
            <MapPin className="size-7" />
          </div>
          <p className="font-display text-xl font-bold">Pick a starting point</p>
          <p className="mt-1 text-sm text-muted">Usually your school. We’ll map everything you can reach.</p>
        </div>
      </div>
    )
  }

  const pins = reachable.slice(0, BALLOT_SIZE).map((p) => ({ id: p.osmId, lat: p.lat, lng: p.lng, label: p.name, status: p.feasibility.status }))

  return (
    <div>
      <div className="relative">
        <MapView start={start} pins={ready ? pins : []} radius={PREFILTER_RADIUS_METERS[mode]} className="aspect-[4/3] lg:aspect-auto lg:h-[56vh]" />
        <AnimatePresence>
          {searching && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[500] grid place-items-center rounded-2xl bg-ink/50 backdrop-blur-[2px]">
              <div className="flex items-center gap-3 rounded-full bg-ink-2/90 px-4 py-2.5 text-sm font-semibold ring-1 ring-cream/10">
                <Spinner className="size-5" /> Checking travel times…
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3">
        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-veto/10 px-4 py-3 ring-1 ring-veto/25">
            <p className="text-sm text-veto">{error}</p>
            <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-cream">
              <RotateCw className="size-4" /> Retry
            </button>
          </div>
        ) : ready ? (
          reachable.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-2">
              <Stat value={reachable.length} label="fit your lunch" accent="text-cream" />
              <Stat value={easyCount} label="easy" accent="text-easy" />
              <Stat value={reachable.length - easyCount} label="tight" accent="text-tight" />
            </motion.div>
          ) : (
            <div className="rounded-2xl bg-cream/[0.03] px-4 py-5 text-center ring-1 ring-cream/10">
              <Utensils className="mx-auto mb-2 size-6 text-dim" />
              <p className="font-display font-bold">Nothing fits this lunch</p>
              <p className="mt-1 text-sm text-muted">
                {nearbyCount === 0
                  ? `No food places found within ${mode === 'walking' ? '1.2 km' : '8 km'}. Try driving or a different start.`
                  : `${nearbyCount} places nearby, but none can be done in time. Try a longer lunch, less eating time, or driving.`}
              </p>
            </div>
          )
        ) : null}
        {ready && reachable.length > 0 && (
          <p className="mt-2 px-1 text-xs text-dim">
            {nearbyCount - reachable.length > 0 && `${nearbyCount - reachable.length} nearby places hidden — they won’t fit. `}
            {reachable.length > BALLOT_SIZE && `Top ${BALLOT_SIZE} go on the ballot. `}
            {estimated && 'Travel times are estimates right now (≈).'}
          </p>
        )}
      </div>
    </div>
  )
}

function Stat({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div className="glass rounded-2xl px-3 py-3 text-center">
      <motion.p key={value} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`font-display text-3xl font-extrabold tabular-nums ${accent}`}>
        {value}
      </motion.p>
      <p className="text-xs font-medium text-muted">{label}</p>
    </div>
  )
}

/** Code + QR + share, and a live row of who has joined while the host sets things up. */
function InviteCard({ code, crewId }: { code: string; crewId: string }) {
  const [people, setPeople] = useState<PresentPerson[]>([])
  const url = `${window.location.origin}/c/${code}`
  const me = getClientId()

  useEffect(() => joinCrewPresence(crewId, { clientId: me, name: getDisplayName(), host: true }, setPeople), [crewId, me])

  const joined = people.filter((p) => p.clientId !== me)

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="glass relative mb-6 overflow-hidden rounded-3xl p-4"
    >
      <div className="absolute -top-16 -right-16 size-44 rounded-full bg-ember/20 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <QRCode value={url} className="w-24 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Friends join with</p>
          <p className="font-mono text-4xl leading-tight font-semibold tracking-[0.14em]">{code}</p>
          <div className="mt-1.5">
            <ShareButton url={url} title="LunchRun" />
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-3 border-t border-cream/10 pt-3">
        {joined.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ember opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-ember" />
            </span>
            Waiting for friends to scan…
          </p>
        ) : (
          <>
            <div className="flex -space-x-2">
              <AnimatePresence>
                {joined.slice(0, 6).map((p) => (
                  <motion.span key={p.clientId} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 20 }}>
                    <Avatar name={p.name} size="size-8" />
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            <p className="min-w-0 truncate text-sm">
              <span className="font-semibold">{joined.length} joined</span>
              <span className="text-muted"> · {joined.map((p) => p.name).join(', ')}</span>
            </p>
          </>
        )}
      </div>
    </motion.section>
  )
}
