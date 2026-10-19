import { AnimatePresence, motion } from 'motion/react'
import { Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Background } from './components/Background'
import { ErrorBoundary, lazyWithReload } from './components/ErrorBoundary'
import { Logo } from './components/Logo'
import { FullPageLoader } from './components/ui'
import CrewHub from './pages/CrewHub'
import Home from './pages/Home'
import NotFound from './pages/NotFound'

// Map-heavy screens load on demand, so the first page a phone opens stays small.
const CreateRound = lazyWithReload(() => import('./pages/CreateRound'))
const Round = lazyWithReload(() => import('./pages/Round'))

export default function App() {
  const location = useLocation()

  return (
    <>
      <Background />
      <header className="sticky top-0 z-40 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 backdrop-blur-md sm:px-6 [mask-image:linear-gradient(black_70%,transparent)]">
        <Logo />
      </header>

      {/* Each route fades/slides in and out as you navigate. */}
      {/* Scroll to top once the old page has animated out, so new pages start at the top. */}
      <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo(0, 0)}>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <ErrorBoundary>
          <Suspense fallback={<FullPageLoader label="Loading…" />}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/c/:code" element={<CrewHub />} />
            <Route path="/c/:code/new" element={<CreateRound />} />
            <Route path="/r/:roundId" element={<Round />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </motion.main>
      </AnimatePresence>
    </>
  )
}
