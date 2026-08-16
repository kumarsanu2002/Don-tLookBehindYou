import { isTouchDevice } from '../device'

interface Props {
  onBack: () => void
}

export function HowToPlay({ onBack }: Props) {
  const touch = isTouchDevice()
  return (
    <div className="overlay">
      <div className="panel howto-panel">
        <h2 className="panel-title">HOW TO PLAY</h2>
        <div className="howto-body">
          <section>
            <h3>The Rule</h3>
            <p>
              Something walks these halls. It freezes whenever you can see it. The instant you look away, it
              moves again. The only thing keeping it still is your attention — and you can't spend all of it.
            </p>
          </section>
          <section>
            <h3>Controls</h3>
            {touch ? (
              <ul>
                <li>
                  <b>Left joystick</b> — aim your flashlight / look
                </li>
                <li>
                  <b>W / A / S / D D-pad</b> — move
                </li>
                <li>
                  <b>Tap the right side</b> — interact (keys, switches, levers, checkpoints)
                </li>
                <li>
                  <b>Pause</b> — use the menu button
                </li>
              </ul>
            ) : (
              <ul>
                <li>
                  <b>WASD / Arrows</b> — move
                </li>
                <li>
                  <b>Shift</b> — sprint (drains stamina, makes noise)
                </li>
                <li>
                  <b>Ctrl / C</b> — crouch (slow, near-silent)
                </li>
                <li>
                  <b>Mouse</b> — look
                </li>
                <li>
                  <b>E</b> — interact (keys, switches, levers, checkpoints)
                </li>
                <li>
                  <b>ESC</b> — pause
                </li>
                <li>
                  <b>F3</b> — debug overlay
                </li>
              </ul>
            )}
            {!touch && <p>Every key is rebindable in Settings.</p>}
          </section>
          <section>
            <h3>Stamina &amp; Composure</h3>
            <ul>
              <li>Sprint is fast but loud. The Watcher hears footsteps — stay quiet when it is near.</li>
              <li>Crouch to move unheard, but you crawl.</li>
              <li>Stamina refills while walking; spend it only when you must.</li>
              <li>Being grazed drains your composure. Let it touch you too many times and it takes you.</li>
              <li>Checkpoints steady your hands and restore your composure.</li>
            </ul>
          </section>
          <section>
            <h3>Survival Tips</h3>
            <ul>
              <li>Keep it in the corner of your eye when you can. It hates being seen.</li>
              <li>You move faster than it does. Not by much. Not for long.</li>
              <li>When it gets close, your vision tunnels and your heartbeat tells you — listen.</li>
              <li>Light is safety. Some machines, keys and doors only respond to it being in the light.</li>
              <li>Mirrors count as looking. Use them. Fear them.</li>
              <li>Sometimes a door only opens when it stands on the plate you cannot step on.</li>
              <li>Pressure plates clatter loudly. Step on one and it will know exactly where you are.</li>
              <li>Notes left by the ones before you hide the truth about this place.</li>
              <li>If it gets close enough to touch you, the lights will tell you first.</li>
            </ul>
          </section>
          <section>
            <h3>Progress</h3>
            <p>
              Blue lights are checkpoints. Reaching one lets you continue from there after it catches you.
              The exit is a door at the end of each level — except the last one, where the exit is only a
              choice you make.
            </p>
          </section>
        </div>
        <button className="btn btn-primary" onClick={onBack}>
          BACK
        </button>
      </div>
    </div>
  )
}
