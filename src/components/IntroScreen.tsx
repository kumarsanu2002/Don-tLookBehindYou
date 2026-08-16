import { useEffect } from 'react'

interface Props {
  onDone: () => void
}

export function IntroScreen({ onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="overlay boot-intro">
      <div className="boot-silhouette" aria-hidden="true" />
      <div className="boot-noise" aria-hidden="true" />
      <div className="boot-inner">
        <p className="boot-kicker">a short walk in the dark</p>
        <h1 className="boot-title" data-text="DON'T LOOK">
          DON'T LOOK
          <span className="boot-sub">BEHIND YOU</span>
        </h1>
        <p className="boot-tagline">It only moves when you aren't looking.</p>
        <p className="boot-warning">Keep your eyes forward. Do not turn around.</p>
      </div>
    </div>
  )
}
