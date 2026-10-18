/**
 * Fixed ambient layer behind every page: drifting color blobs ("aurora"),
 * a fading dot grid, and animated film grain. Purely decorative.
 */
export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="aurora-blob bg-ember"
        style={{ width: '46vmax', height: '46vmax', top: '-18vmax', left: '-12vmax', animation: 'drift-a 22s ease-in-out infinite' }}
      />
      <div
        className="aurora-blob bg-plum"
        style={{ width: '38vmax', height: '38vmax', top: '30vh', right: '-16vmax', opacity: 0.35, animation: 'drift-b 26s ease-in-out infinite' }}
      />
      <div
        className="aurora-blob bg-easy"
        style={{ width: '24vmax', height: '24vmax', bottom: '-12vmax', left: '20vw', opacity: 0.16, animation: 'drift-c 30s ease-in-out infinite' }}
      />
      <div className="dot-grid absolute inset-0" />
      {/* Darkens the bottom so content stays readable over the glow. */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/40 to-ink" />
      <div className="grain" />
    </div>
  )
}
