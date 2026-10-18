import { AnimatePresence, motion } from 'motion/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Background } from './components/Background'
import { Logo } from './components/Logo'
import ComingSoon from './pages/ComingSoon'
import Home from './pages/Home'

export default function App() {
  const location = useLocation()

  return (
    <>
      <Background />
      <header className="sticky top-0 z-40 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 backdrop-blur-md sm:px-6 [mask-image:linear-gradient(black_70%,transparent)]">
        <Logo />
        <span className="rounded-full bg-cream/5 px-3 py-1 font-mono text-[11px] font-semibold tracking-wider text-muted ring-1 ring-cream/10">
          BETA
        </span>
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
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/crew/:code" element={<ComingSoon title="Lobby" day={4} />} />
            <Route path="/crew/:code/new" element={<ComingSoon title="New lunch" day={3} />} />
            <Route path="/crew/:code/vote" element={<ComingSoon title="Vote" day={5} />} />
            <Route path="/crew/:code/results" element={<ComingSoon title="Results" day={5} />} />
            <Route path="/crew/:code/history" element={<ComingSoon title="History" day={6} />} />
            <Route path="*" element={<ComingSoon title="Lost? This page doesn't exist." day={0} />} />
          </Routes>
        </motion.main>
      </AnimatePresence>
    </>
  )
}
