export interface Achievement {
  id: string
  name: string
  desc: string
  /** hidden achievements are shown as "???" until unlocked */
  hidden?: boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood', name: 'FIRST TOUCH', desc: 'Let the Watcher get close enough to graze you.' },
  { id: 'survivor', name: 'UNTOUCHED', desc: 'Escape a level without being grazed once.' },
  { id: 'scribe', name: 'THE SCRIBE', desc: 'Read every note in a single level.' },
  { id: 'no_look', name: 'BLINDFOLD', desc: 'Escape a level without ever catching sight of the Watcher.' },
  { id: 'shadow', name: 'GHOST', desc: 'Escape a level without the Watcher ever sensing you.' },
  { id: 'speedster', name: 'THE SPRINT', desc: 'Escape a level in under sixty seconds.' },
  { id: 'walker', name: 'THE WALKER', desc: 'Escape every level the facility has to offer.' },
  { id: 'piper', name: 'THE PIPER', desc: 'Use sound to lure the Watcher away from you.' },
  { id: 'crank', name: 'THE MACHINIST', desc: 'Hold a crank steady in full view until the gears turn.' },
  { id: 'archivist', name: 'THE ARCHIVIST', desc: 'Read every fragment of the hidden story.', hidden: true },
  { id: 'releaser', name: 'THE RELEASER', desc: 'Let it leave. Let yourself leave.', hidden: true },
]

export const getAchievement = (id: string): Achievement | undefined =>
  ACHIEVEMENTS.find((a) => a.id === id)
