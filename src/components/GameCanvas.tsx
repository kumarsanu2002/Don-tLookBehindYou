import { useEffect, useRef } from 'react'
import type { SaveData } from '../types'
import { Game } from '../game/Game'
import type { GameCallbacks } from '../types'

interface Props {
  save: SaveData
  callbacks: GameCallbacks
  onReady: (game: Game) => void
}

export function GameCanvas({ save, callbacks, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const savedRef = useRef(save)
  const cbRef = useRef(callbacks)
  const readyRef = useRef(onReady)
  savedRef.current = save
  cbRef.current = callbacks
  readyRef.current = onReady

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const game = new Game(canvas, savedRef.current, cbRef.current)
    game.start()
    readyRef.current(game)
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__dlby = game
    }
    return () => {
      game.destroy()
      if (import.meta.env.DEV) {
        delete (window as unknown as Record<string, unknown>).__dlby
      }
    }
  }, [])

  return (
    <div className="game-canvas-wrap">
      <canvas ref={canvasRef} className="game-canvas" />
    </div>
  )
}
