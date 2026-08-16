import { isTouchDevice } from '../device'

interface IntroData {
  id: number
  name: string
  subtitle: string
  briefing: string[]
}

interface Props {
  data: IntroData
  onBegin: () => void
}

export function LevelIntro({ data, onBegin }: Props) {
  const touch = isTouchDevice()
  const briefing = data.briefing.map((line) =>
    line.includes('Move with WASD')
      ? touch
        ? 'Move with the D-pad. Your eyes follow the left joystick.'
        : 'Move with WASD. Your eyes follow the mouse.'
      : line,
  )
  return (
    <div className="overlay intro-overlay">
      <div className="intro-inner">
        <p className="intro-level">LEVEL {data.id}</p>
        <h2 className="intro-title">{data.name}</h2>
        <p className="intro-subtitle">{data.subtitle}</p>
        <div className="intro-briefing">
          {briefing.map((line, i) => (
            <p key={i} className="intro-line">
              {line}
            </p>
          ))}
        </div>
        <button className="btn btn-primary" onClick={onBegin}>
          BEGIN
        </button>
        <p className="menu-hint">Remember: it only moves when you aren't looking.</p>
      </div>
    </div>
  )
}
