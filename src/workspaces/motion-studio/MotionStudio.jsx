import { useMemo, useState } from 'react'
import { loadCharacters } from '../../lib/character-store.js'
import './motion-studio.css'

const MOTION_OPTIONS = [
  { id: 'idle', label: 'Idle' },
  { id: 'wave', label: 'Wave' },
  { id: 'jump', label: 'Jump' },
  { id: 'run', label: 'Run' },
  { id: 'sit', label: 'Sit' },
  { id: 'dance', label: 'Dance' },
]

export function MotionStudio() {
  const [selectedMotion, setSelectedMotion] = useState('idle')
  const [speed, setSpeed] = useState(1)
  const [characters] = useState(function read() {
    return loadCharacters()
  })
  const selectedCharacter = useMemo(function pick() {
    return characters[0] || null
  }, [characters])

  if (!selectedCharacter) {
    return null
  }

  return (
    <div className="motion-studio">
      <div className="section-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h3>Motion Studio</h3>
          <p>Procedural movement previews built from a simple local character rig.</p>
        </div>
      </div>

      <div className="motion-layout">
        <section className="panel motion-stage-panel">
          <div className="motion-stage">
            <div className={`motion-character motion-${selectedMotion}`} style={{ '--skin-tone': selectedCharacter.skinTone, '--hair-color': selectedCharacter.hairColor, '--eye-color': selectedCharacter.eyeColor, '--outfit-color': selectedCharacter.outfitColor, '--accent-color': selectedCharacter.accentColor, '--speed': speed }}>
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
        </section>

        <aside className="panel motion-controls-panel">
          <h3>Movement library</h3>
          <div className="seg" role="group" aria-label="Movement library">
            {MOTION_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={selectedMotion === option.id ? 'active' : ''}
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
              Playback speed <span>{speed.toFixed(2)}×</span>
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

          <div className="notice">
            This is a procedural animation preview for the next milestone. It is not a full 3D rig or motion capture system yet.
          </div>
        </aside>
      </div>
    </div>
  )
}
