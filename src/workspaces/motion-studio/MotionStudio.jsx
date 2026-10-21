import { useMemo, useState } from 'react'
import { loadCharacters } from '../../lib/character-store.js'
import { MotionViewer } from './MotionViewer.jsx'
import './motion-studio.css'

// "clip" is the animation name inside RobotExpressive.glb.
// "flat" marks motions that the 2D CSS preview also supports.
const MOTION_OPTIONS = [
  { id: 'idle', label: 'Idle', clip: 'Idle', flat: true },
  { id: 'walk', label: 'Walk', clip: 'Walking', flat: false },
  { id: 'wave', label: 'Wave', clip: 'Wave', flat: true },
  { id: 'jump', label: 'Jump', clip: 'Jump', flat: true },
  { id: 'run', label: 'Run', clip: 'Running', flat: true },
  { id: 'sit', label: 'Sit', clip: 'Sitting', flat: true },
  { id: 'dance', label: 'Dance', clip: 'Dance', flat: true },
]

export function MotionStudio() {
  const [view, setView] = useState('3d')
  const [selectedMotion, setSelectedMotion] = useState('idle')
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [loop, setLoop] = useState(true)
  const [restart, setRestart] = useState(0)
  const [clips, setClips] = useState([])
  const [characters] = useState(function read() {
    return loadCharacters()
  })
  const selectedCharacter = useMemo(function pick() {
    return characters[0] || null
  }, [characters])

  const options = MOTION_OPTIONS.filter((option) => view === '3d' || option.flat)
  const activeOption = MOTION_OPTIONS.find((option) => option.id === selectedMotion) || MOTION_OPTIONS[0]

  function changeView(next) {
    setView(next)
    setClips([])
    if (next === '2d' && !activeOption.flat) {
      setSelectedMotion('idle')
    }
  }

  return (
    <div className="motion-studio">
      <div className="section-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h3>Motion Studio</h3>
          <p>Preview movements on a 3D character, or on a simple 2D character built from your saved colors.</p>
        </div>
      </div>

      <div className="motion-layout">
        <section className="panel motion-stage-panel">
          <div className="seg" role="group" aria-label="Preview type">
            <button type="button" className={view === '3d' ? 'active' : ''} onClick={() => changeView('3d')}>
              3D robot
            </button>
            <button type="button" className={view === '2d' ? 'active' : ''} onClick={() => changeView('2d')}>
              2D character
            </button>
          </div>

          {view === '3d' ? (
            <MotionViewer
              clip={activeOption.clip}
              speed={speed}
              paused={paused}
              loop={loop}
              restart={restart}
              onReady={setClips}
            />
          ) : selectedCharacter ? (
            <div className="motion-stage">
              <div
                className={`motion-character motion-${selectedMotion}`}
                style={{
                  '--skin-tone': selectedCharacter.skinTone,
                  '--hair-color': selectedCharacter.hairColor,
                  '--eye-color': selectedCharacter.eyeColor,
                  '--outfit-color': selectedCharacter.outfitColor,
                  '--accent-color': selectedCharacter.accentColor,
                  '--speed': speed,
                }}
              >
                <div className="motion-shadow" />
                <div className="motion-hair" />
                <div className="motion-head">
                  <div className="motion-eye left" />
                  <div className="motion-eye right" />
                  <div className="motion-mouth" />
                </div>
                <div className="motion-body">
                  <div className="motion-arm left" />
                  <div className="motion-arm right" />
                  <div className="motion-leg left" />
                  <div className="motion-leg right" />
                </div>
              </div>
            </div>
          ) : (
            <div className="notice">Create a character in Character Studio to see the 2D preview.</div>
          )}
        </section>

        <aside className="panel motion-controls-panel">
          <h3>Movement library</h3>
          <div className="seg" role="group" aria-label="Movement library">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={selectedMotion === option.id ? 'active' : ''}
                disabled={view === '3d' && clips.length > 0 && !clips.includes(option.clip)}
                onClick={function select() {
                  setSelectedMotion(option.id)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="field">
            <span className="field-top">
              Playback speed <span>{speed.toFixed(2)}&times;</span>
            </span>
            <input
              type="range"
              min="0.4"
              max="2"
              step="0.1"
              value={speed}
              onChange={function change(event) {
                setSpeed(Number(event.target.value))
              }}
            />
          </label>

          {view === '3d' ? (
            <>
              <div className="motion-buttons">
                <button type="button" className="primary-btn small" onClick={() => setPaused(!paused)}>
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button type="button" className="primary-btn small" onClick={() => setRestart(restart + 1)}>
                  Restart
                </button>
              </div>
              <label className="motion-loop">
                <input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} />
                Loop animation
              </label>
              <div className="notice">
                The 3D preview uses a free sample robot (RobotExpressive, CC0). Your saved characters can&apos;t be
                applied to it yet. Drag to rotate and scroll to zoom.
              </div>
            </>
          ) : (
            <div className="notice">
              The 2D preview is a procedural animation built from your first saved character. It is not a 3D rig or
              motion capture.
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}