/**
 * The hidden lore arc: five notes spread across the five new levels.
 * Read every one before escaping the Labyrinth to unlock the secret ending.
 */
export interface StoryNote {
  id: string
  levelId: number
  index: number
  text: string
}

export const STORY_NOTES: StoryNote[] = [
  {
    id: 'story_blink',
    levelId: 9,
    index: 0,
    text: 'ENTRY 1 — Blink tests. The subjects report a flicker every four seconds, like a camera shutter. In that flicker, it steps. They told us to hold the stare. They were wrong. Blink first. Blink on purpose.',
  },
  {
    id: 'story_listener',
    levelId: 10,
    index: 1,
    text: 'ENTRY 2 — It does not see in the dark any better than we do. It listens. We learned to move unheard, one breath at a time. Then we found the music box in the stores, and it followed the song like a moth. We stopped laughing at the metaphor when the box went quiet.',
  },
  {
    id: 'story_mirrors',
    levelId: 11,
    index: 2,
    text: 'ENTRY 3 — It casts no reflection. That is why the glass unnerves it. We built the maze to keep it seen, and it learned to hide behind the false mirrors — the ones we hung where no reflection could ever fall. It waits behind them now. All of them.',
  },
  {
    id: 'story_bell',
    levelId: 12,
    index: 3,
    text: 'ENTRY 4 — The bell is the only clock it obeys. When it tolls, it moves. When it is silent, it waits. The tower was supposed to be the lock. We did not understand until too late: the bell was never counting for us. It was counting for the last toll of all.',
  },
  {
    id: 'story_labyrinth',
    levelId: 13,
    index: 4,
    text: 'ENTRY 5 — Final. They said: lock it in the Labyrinth, three locks, throw away the map. But it was never locked in. We were. The one who looks is the one who stays — that was always the rule, and we wrote it down and forgot what it meant. Stop looking. Let it leave. Let yourself leave.',
  },
]

export const STORY_NOTE_IDS = STORY_NOTES.map((n) => n.id)

/** does the given set of read note ids cover the whole arc? */
export function isStoryComplete(readIds: string[]): boolean {
  return STORY_NOTE_IDS.every((id) => readIds.includes(id))
}
