import { RotateCw, TriangleAlert } from 'lucide-react'
import { Component, lazy, type ComponentType, type ReactNode } from 'react'

const RELOAD_KEY = 'lunchrun:chunk-reload'

/**
 * lazy() that survives deploys: if the page was loaded before a new deploy,
 * its old code-split files no longer exist. Instead of crashing, reload once
 * to pick up the new version.
 */
export function lazyWithReload<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await load()
      try {
        sessionStorage.removeItem(RELOAD_KEY)
      } catch {
        /* ignore */
      }
      return mod
    } catch (err) {
      let alreadyReloaded = false
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === '1'
        sessionStorage.setItem(RELOAD_KEY, '1')
      } catch {
        /* ignore */
      }
      if (!alreadyReloaded) {
        window.location.reload()
        return new Promise<never>(() => {}) // keep showing the loader while reloading
      }
      throw err
    }
  })
}

/** Last-resort safety net: a friendly screen instead of a blank page if something crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[LunchRun crashed]', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-ember/10 text-ember ring-1 ring-ember/20">
          <TriangleAlert className="size-7" />
        </div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Something went sideways</h1>
        <p className="mt-2 text-[15px] text-muted">Reloading usually fixes it. Your vote is saved.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-ember px-6 font-display font-bold text-ink"
        >
          <RotateCw className="size-5" /> Reload
        </button>
      </div>
    )
  }
}
