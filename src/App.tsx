import { useCallback, useRef, useState } from 'react'
import type { GameCallbacks, GameState, SaveData } from './types'
import { Game } from './game/Game'
import { SaveManager } from './game/SaveManager'
import { getAchievement } from './game/Achievements'
import { GameCanvas } from './components/GameCanvas'
import { MainMenu } from './components/MainMenu'
import { LevelSelect } from './components/LevelSelect'
import { PauseMenu } from './components/PauseMenu'
import { Settings } from './components/Settings'
import { GameOver } from './components/GameOver'
import { LevelComplete } from './components/LevelComplete'
import { VictoryScreen } from './components/VictoryScreen'
import { LevelIntro } from './components/LevelIntro'
import { HowToPlay } from './components/HowToPlay'
import { Credits } from './components/Credits'
import { Achievements } from './components/Achievements'
import { AchievementToast } from './components/AchievementToast'
import { NoteOverlay } from './components/NoteOverlay'
import { RotateHint } from './components/RotateHint'
import { IntroScreen } from './components/IntroScreen'

interface IntroData {
  id: number
  name: string
  subtitle: string
  briefing: string[]
}
interface DeathData {
  checkpoint: { x: number; y: number }
  hasCheckpoint: boolean
  reason: string
}
interface CompleteData {
  levelId: number
  nextLevel: number | null
}
interface AchievementToastData {
  id: number
  name: string
  desc: string
}

export default function App() {
  const [showIntro, setShowIntro] = useState(true)
  const [gameState, setGameState] = useState<GameState>('MENU')
  const [screen, setScreen] = useState<'main' | 'levels' | 'settings' | 'howto' | 'credits' | 'achievements'>('main')
  const [save, setSave] = useState<SaveData>(() => SaveManager.load())
  const [intro, setIntro] = useState<IntroData | null>(null)
  const [death, setDeath] = useState<DeathData | null>(null)
  const [complete, setComplete] = useState<CompleteData | null>(null)
  const [secretEnding, setSecretEnding] = useState(false)
  const [soundVolume, setSoundVolume] = useState(save.soundVolume)
  const [musicVolume, setMusicVolume] = useState(save.musicVolume)
  const [settings, setSettingsState] = useState(save.settings)
  const [note, setNote] = useState<{ text: string } | null>(null)
  const [achievementToast, setAchievementToast] = useState<AchievementToastData | null>(null)
  const gameRef = useRef<Game | null>(null)
  const toastId = useRef(0)

  const hasProgress = save.currentLevel > 1 || save.completedLevels.length > 0

  const onReady = useCallback((game: Game) => {
    gameRef.current = game
  }, [])

  const callbacks: GameCallbacks = {
    onStateChange: (s: GameState) => {
      setGameState(s)
      if (s === 'PLAYING') {
        setIntro(null)
      }
      if (s === 'MENU') {
        setSave(SaveManager.load())
      }
    },
    onLevelIntro: (data: IntroData) => {
      setIntro(data)
    },
    onDeath: (data: DeathData) => {
      setDeath(data)
    },
    onLevelComplete: (data: CompleteData) => {
      setComplete(data)
      setSave(SaveManager.load())
    },
    onGameComplete: (secret?: boolean) => {
      setSecretEnding(!!secret)
      setSave(SaveManager.load())
    },
    onNote: (data: { text: string }) => {
      setNote(data)
    },
    onAchievement: (id: string) => {
      const a = getAchievement(id)
      if (!a) return
      toastId.current += 1
      setAchievementToast({ id: toastId.current, name: a.name, desc: a.desc })
    },
  }

  const updateSettings = useCallback(
    (patch: Partial<SaveData['settings']>) => {
      setSettingsState((prev) => {
        const next = { ...prev, ...patch }
        gameRef.current?.setSettings(next)
        return next
      })
    },
    [],
  )

  const changeSound = useCallback(
    (v: number) => {
      setSoundVolume(v)
      gameRef.current?.setVolumes(v, musicVolume)
    },
    [musicVolume],
  )

  const changeMusic = useCallback(
    (v: number) => {
      setMusicVolume(v)
      gameRef.current?.setVolumes(soundVolume, v)
    },
    [soundVolume],
  )

  const handlePlay = useCallback(() => {
    SaveManager.reset()
    const fresh = SaveManager.load()
    setSave(fresh)
    setSoundVolume(fresh.soundVolume)
    setMusicVolume(fresh.musicVolume)
    gameRef.current?.newGame()
  }, [])

  const handleContinue = useCallback(() => {
    gameRef.current?.continueGame()
  }, [])

  const handleBeginLevel = useCallback(() => {
    setIntro(null)
    gameRef.current?.startPlay()
  }, [])

  const handleRespawn = useCallback(() => {
    setDeath(null)
    gameRef.current?.respawn()
  }, [])

  const handleRestartLevel = useCallback(() => {
    setDeath(null)
    gameRef.current?.restartLevel()
  }, [])

  const handleNextLevel = useCallback(() => {
    setComplete(null)
    gameRef.current?.nextLevel()
  }, [])

  const handleMenu = useCallback(() => {
    setScreen('main')
    setIntro(null)
    setDeath(null)
    setComplete(null)
    setNote(null)
    gameRef.current?.quitToMenu()
  }, [])

  const handleSelectLevel = useCallback((id: number) => {
    setScreen('main')
    gameRef.current?.startLevel(id)
  }, [])

  return (
    <div className="app">
      <GameCanvas save={save} callbacks={callbacks} onReady={onReady} />

      {gameState === 'MENU' && screen === 'main' && !showIntro && (
        <MainMenu
          hasSave={hasProgress}
          onPlay={handlePlay}
          onContinue={handleContinue}
          onLevels={() => setScreen('levels')}
          onSettings={() => setScreen('settings')}
          onHowTo={() => setScreen('howto')}
          onCredits={() => setScreen('credits')}
          onAchievements={() => setScreen('achievements')}
        />
      )}

      {gameState === 'MENU' && screen === 'levels' && (
        <LevelSelect
          highestUnlocked={save.highestUnlockedLevel}
          completedLevels={save.completedLevels}
          onSelect={handleSelectLevel}
          onBack={() => setScreen('main')}
        />
      )}

      {gameState === 'MENU' && screen === 'achievements' && (
        <Achievements unlocked={save.achievements} onBack={() => setScreen('main')} />
      )}

      {screen === 'settings' && (
        <Settings
          soundVolume={soundVolume}
          musicVolume={musicVolume}
          settings={settings}
          onSound={changeSound}
          onMusic={changeMusic}
          onSettings={updateSettings}
          onReset={() => {
            SaveManager.reset()
            const fresh = SaveManager.load()
            setSave(fresh)
            setSoundVolume(fresh.soundVolume)
            setMusicVolume(fresh.musicVolume)
            setSettingsState(fresh.settings)
            gameRef.current?.quitToMenu()
            setScreen('main')
          }}
          onBack={() => setScreen('main')}
        />
      )}

      {screen === 'howto' && <HowToPlay onBack={() => setScreen('main')} />}
      {screen === 'credits' && <Credits onBack={() => setScreen('main')} />}

      {intro && gameState === 'PLAYING' && (
        <LevelIntro data={intro} onBegin={handleBeginLevel} />
      )}

      {note && gameState === 'PLAYING' && !intro && (
        <NoteOverlay text={note.text} onClose={() => setNote(null)} />
      )}

      {gameState === 'PLAYING' && <AchievementToast toast={achievementToast} />}

      {screen === 'main' && gameState === 'PAUSED' && (
        <PauseMenu
          onResume={() => gameRef.current?.resume()}
          onRestart={() => {
            gameRef.current?.restartLevel()
          }}
          onSettings={() => setScreen('settings')}
          onQuit={handleMenu}
        />
      )}

      {gameState === 'DEAD' && death && (
        <GameOver
          reason={death.reason}
          hasCheckpoint={death.hasCheckpoint}
          onRespawn={handleRespawn}
          onRestartLevel={handleRestartLevel}
          onQuit={handleMenu}
        />
      )}

      {gameState === 'LEVEL_COMPLETE' && complete && (
        <LevelComplete
          levelId={complete.levelId}
          nextLevel={complete.nextLevel}
          onNext={handleNextLevel}
          onMenu={handleMenu}
        />
      )}

      {gameState === 'GAME_COMPLETE' && (
        <VictoryScreen
          secret={secretEnding}
          onMenu={handleMenu}
          onRestart={() => {
            gameRef.current?.newGame()
          }}
        />
      )}

      <RotateHint />

      {showIntro && <IntroScreen onDone={() => setShowIntro(false)} />}
    </div>
  )
}
