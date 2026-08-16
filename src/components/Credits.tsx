interface Props {
  onBack: () => void
}

export function Credits({ onBack }: Props) {
  return (
    <div className="overlay">
      <div className="panel credits-panel">
        <h2 className="panel-title">CREDITS</h2>
        <div className="credits-body">
          <p className="credits-title">DON'T LOOK BEHIND YOU</p>
          <p className="credits-sub">A psychological horror puzzle in eight rooms.</p>
          <hr />
          <p>
            <b>Design &amp; Code</b> — Built as a fully procedural browser game with React, TypeScript and the
            HTML5 Canvas API.
          </p>
          <p>
            <b>Art</b> — 100% procedurally rendered. Every silhouette, wall, flicker and fog bank is drawn at
            runtime. No image assets were harmed.
          </p>
          <p>
            <b>Sound</b> — Synthesized in-browser with the Web Audio API. Every drone, knock, whisper and
            heartbeat is generated live, layered by how close it is.
          </p>
          <p>
            <b>Inspired by</b> — the timeless playground rule: it only moves when you aren't looking. You know
            the one. We've all played it.
          </p>
          <p className="credits-hint">If you're reading this, it's behind you. It's always behind you.</p>
        </div>
        <button className="btn btn-primary" onClick={onBack}>
          BACK
        </button>
      </div>
    </div>
  )
}
