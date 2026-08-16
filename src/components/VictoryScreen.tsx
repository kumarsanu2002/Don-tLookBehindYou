interface Props {
  secret?: boolean
  onMenu: () => void
  onRestart: () => void
}

export function VictoryScreen({ secret, onMenu, onRestart }: Props) {
  return (
    <div className="overlay victory-overlay">
      <div className="victory-inner">
        <p className="victory-eyebrow">{secret ? 'SECRET ENDING' : 'ALL 13 LEVELS COMPLETE'}</p>
        <h2 className="victory-title">{secret ? 'YOU STOPPED LOOKING.' : 'YOU LEFT THE FACILITY.'}</h2>
        {secret ? (
          <p className="victory-text">
            The Watcher does not reach for you. It simply stands, turns, and walks away into the
            dark — and the door at the end of the Labyrinth is open. You carried every note with
            you, and that was enough. Some doors only open when you finally turn away, and this
            time you let it go.
          </p>
        ) : (
          <p className="victory-text">
            You walked out of the facility, and the Watcher stayed behind in the dark. But there
            are notes you left unread — fragments of a story that only makes sense when you have
            seen all of it. If the walls grow again, go back and read everything before the end.
          </p>
        )}
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={onRestart}>
            PLAY AGAIN
          </button>
          <button className="btn" onClick={onMenu}>
            MENU
          </button>
        </div>
      </div>
    </div>
  )
}
