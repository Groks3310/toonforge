import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Download, Play, Plus, Square, Trash2, Upload } from 'lucide-react'
import { loadCharacters } from '../../lib/character-store.js'
import { MOTION_OPTIONS } from '../../lib/motion-library.js'
import {
  createSequence,
  createStep,
  loadSequences,
  normalizeSequence,
  saveSequences,
} from '../../lib/motion-sequence-store.js'
import { MotionViewer } from './MotionViewer.jsx'
import './motion-studio.css'

const DURATIONS = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30]

function sleep(ms) {
  return new Promise(function run(resolve) {
    setTimeout(resolve, ms)
  })
}

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
  const [characterIndex, setCharacterIndex] = useState(0)

  const [sequences, setSequences] = useState(loadSequences)
  const [sequenceId, setSequenceId] = useState(function pickFirst() {
    return sequences[0].id
  })
  const [playingSeq, setPlayingSeq] = useState(false)
  const [playingIndex, setPlayingIndex] = useState(-1)
  const [notice, setNotice] = useState('')
  const runRef = useRef(0)
  const fileInputRef = useRef(null)

  const selectedCharacter = useMemo(function pick() {
    return characters[characterIndex] || characters[0] || null
  }, [characters, characterIndex])

  useEffect(
    function persist() {
      saveSequences(sequences)
    },
    [sequences],
  )

  // Stop any running sequence when leaving Motion Studio.
  useEffect(function cleanup() {
    return function stopOnLeave() {
      runRef.current += 1
    }
  }, [])

  const options = MOTION_OPTIONS.filter((option) => view === '3d' || option.flat)
  const activeOption = MOTION_OPTIONS.find((option) => option.id === selectedMotion) || MOTION_OPTIONS[0]
  const sequence = sequences.find((item) => item.id === sequenceId) || sequences[0]
  const totalSeconds = sequence.steps.reduce((sum, step) => sum + step.seconds, 0)

  function stopSequence() {
    runRef.current += 1
    setPlayingSeq(false)
    setPlayingIndex(-1)
  }

  async function playSequence() {
    const steps = sequence.steps
    if (steps.length === 0) return
    const token = runRef.current + 1
    runRef.current = token
    setPlayingSeq(true)
    setPaused(false)

    for (let i = 0; i < steps.length; i += 1) {
      if (runRef.current !== token) return
      setPlayingIndex(i)
      setSelectedMotion(steps[i].motionId)
      setRestart((count) => count + 1)
      await sleep(steps[i].seconds * 1000)
    }

    if (runRef.current === token) {
      setPlayingSeq(false)
      setPlayingIndex(-1)
    }
  }

  function changeView(next) {
    stopSequence()
    setView(next)
    setClips([])
    if (next === '2d' && !activeOption.flat) {
      setSelectedMotion('idle')
    }
  }

  function changeSequence(change) {
    setSequences(function apply(list) {
      return list.map((item) => (item.id === sequence.id ? change(item) : item))
    })
  }

  function updateStep(stepId, patch) {
    changeSequence((item) => ({
      ...item,
      steps: item.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
    }))
  }

  function addStep() {
    changeSequence((item) => ({ ...item, steps: [...item.steps, createStep()] }))
  }

  function duplicateStep(index) {
    changeSequence(function apply(item) {
      const steps = [...item.steps]
      steps.splice(index + 1, 0, { ...steps[index], id: createStep().id })
      return { ...item, steps }
    })
  }

  function removeStep(stepId) {
    changeSequence((item) => ({ ...item, steps: item.steps.filter((step) => step.id !== stepId) }))
  }

  function moveStep(index, direction) {
    const target = index + direction
    if (target < 0 || target >= sequence.steps.length) return
    changeSequence(function apply(item) {
      const steps = [...item.steps]
      const [moved] = steps.splice(index, 1)
      steps.splice(target, 0, moved)
      return { ...item, steps }
    })
  }

  function addSequence() {
    stopSequence()
    const next = createSequence({ name: 'Sequence ' + (sequences.length + 1) })
    setSequences([...sequences, next])
    setSequenceId(next.id)
  }

  function deleteSequence() {
    if (!window.confirm('Delete "' + sequence.name + '"?')) return
    stopSequence()
    const rest = sequences.filter((item) => item.id !== sequence.id)
    const next = rest.length > 0 ? rest : [createSequence({ name: 'My sequence' })]
    setSequences(next)
    setSequenceId(next[0].id)
  }

  function exportSequences() {
    const payload = { app: 'toonforge', type: 'motion-sequences', version: 1, sequences }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'toonforge-motion-sequences.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setNotice('Exported ' + sequences.length + (sequences.length === 1 ? ' sequence.' : ' sequences.'))
  }

  function importSequences(event) {
    const file = event.target.files && event.target.files[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setNotice('That file is too large to be a sequence file.')
      return
    }
    const reader = new FileReader()
    reader.onerror = function failed() {
      setNotice('Could not read that file.')
    }
    reader.onload = function loaded() {
      try {
        const data = JSON.parse(String(reader.result))
        const list = Array.isArray(data) ? data : data && Array.isArray(data.sequences) ? data.sequences : null
        if (!list || list.length === 0) {
          throw new Error('No sequences found in this file.')
        }
        const imported = list.map(function fresh(item) {
          const clean = normalizeSequence(item)
          return {
            ...clean,
            id: createSequence().id,
            steps: clean.steps.map((step) => ({ ...step, id: createStep().id })),
          }
        })
        stopSequence()
        setSequences((previous) => [...previous, ...imported])
        setSequenceId(imported[0].id)
        setNotice('Imported ' + imported.length + (imported.length === 1 ? ' sequence.' : ' sequences.'))
      } catch (error) {
        setNotice('Could not import: ' + (error.message || 'invalid file.'))
      }
    }
    reader.readAsText(file)
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

          {characters.length > 0 ? (
            <label className="field">
              <span className="field-top">Character</span>
              <select
                value={characterIndex}
                onChange={(event) => setCharacterIndex(Number(event.target.value))}
              >
                {characters.map((character, index) => (
                  <option key={index} value={index}>
                    {character.name || 'Character ' + (index + 1)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {view === '3d' ? (
            <MotionViewer
              clip={activeOption.clip}
              speed={speed}
              paused={paused}
              loop={loop || playingSeq}
              restart={restart}
              onReady={setClips}
              colors={
                selectedCharacter
                  ? {
                      outfit: selectedCharacter.outfitColor,
                      accent: selectedCharacter.accentColor,
                      eyes: selectedCharacter.eyeColor,
                    }
                  : undefined
              }
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
                disabled={playingSeq || (view === '3d' && clips.length > 0 && !clips.includes(option.clip))}
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
                <button type="button" className="primary-btn small" disabled={playingSeq} onClick={() => setPaused(!paused)}>
                  {paused ? 'Resume' : 'Pause'}
                </button>
                <button type="button" className="primary-btn small" disabled={playingSeq} onClick={() => setRestart(restart + 1)}>
                  Restart
                </button>
              </div>
              <label className="motion-loop">
                <input
                  type="checkbox"
                  checked={loop}
                  disabled={playingSeq}
                  onChange={(event) => setLoop(event.target.checked)}
                />
                Loop animation
              </label>
              <div className="notice">
                The 3D preview uses a free sample robot (RobotExpressive, CC0). Your character&apos;s outfit, accent
                and eye colors are applied to it. Hair, skin tone and outfit style are not. Drag to rotate and scroll
                to zoom.
              </div>
            </>
          ) : (
            <div className="notice">
              The 2D preview is a procedural animation built from the selected character. It is not a 3D rig or
              motion capture. Sequences play on the 3D robot.
            </div>
          )}
        </aside>
      </div>

      {view === '3d' ? (
        <section className="panel motion-sequence-panel">
          <div className="motion-sequence-head">
            <label className="field">
              <span className="field-top">Sequence</span>
              <select
                value={sequence.id}
                disabled={playingSeq}
                onChange={(event) => setSequenceId(event.target.value)}
              >
                {sequences.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-top">Name</span>
              <input
                value={sequence.name}
                disabled={playingSeq}
                onChange={(event) => changeSequence((item) => ({ ...item, name: event.target.value }))}
              />
            </label>
            <button type="button" className="primary-btn small" disabled={playingSeq} onClick={addSequence}>
              <Plus size={14} /> New
            </button>
            <button type="button" className="primary-btn small" disabled={playingSeq} onClick={deleteSequence}>
              <Trash2 size={14} /> Delete
            </button>
          </div>

          <fieldset className="motion-fieldset" disabled={playingSeq}>
            {sequence.steps.length === 0 ? (
              <div className="notice">No steps yet. Add a step to start building a sequence.</div>
            ) : (
              <ol className="motion-step-list">
                {sequence.steps.map(function renderStep(step, index) {
                  const durations = DURATIONS.includes(step.seconds)
                    ? DURATIONS
                    : [...DURATIONS, step.seconds].sort((a, b) => a - b)
                  return (
                    <li key={step.id} className={index === playingIndex ? 'motion-step active' : 'motion-step'}>
                      <span className="motion-step-number">{index + 1}</span>
                      <select
                        aria-label={'Step ' + (index + 1) + ' motion'}
                        value={step.motionId}
                        onChange={(event) => updateStep(step.id, { motionId: event.target.value })}
                      >
                        {MOTION_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                      <select
                        aria-label={'Step ' + (index + 1) + ' duration in seconds'}
                        value={step.seconds}
                        onChange={(event) => updateStep(step.id, { seconds: Number(event.target.value) })}
                      >
                        {durations.map((value) => (
                          <option key={value} value={value}>{value} s</option>
                        ))}
                      </select>
                      <span className="motion-step-actions">
                        <button
                          type="button"
                          className="primary-btn small"
                          aria-label={'Move step ' + (index + 1) + ' up'}
                          disabled={index === 0}
                          onClick={() => moveStep(index, -1)}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="primary-btn small"
                          aria-label={'Move step ' + (index + 1) + ' down'}
                          disabled={index === sequence.steps.length - 1}
                          onClick={() => moveStep(index, 1)}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          className="primary-btn small"
                          aria-label={'Duplicate step ' + (index + 1)}
                          onClick={() => duplicateStep(index)}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          className="primary-btn small"
                          aria-label={'Remove step ' + (index + 1)}
                          onClick={() => removeStep(step.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
            <div className="motion-buttons">
              <button type="button" className="primary-btn small" onClick={addStep}>
                <Plus size={14} /> Add step
              </button>
            </div>
          </fieldset>

          <div className="motion-buttons">
            <button
              type="button"
              className="primary-btn small"
              disabled={playingSeq || sequence.steps.length === 0}
              onClick={playSequence}
            >
              <Play size={14} /> Play sequence
            </button>
            <button type="button" className="primary-btn small" disabled={!playingSeq} onClick={stopSequence}>
              <Square size={14} /> Stop
            </button>
            <button type="button" className="primary-btn small" disabled={playingSeq} onClick={exportSequences}>
              <Download size={14} /> Export
            </button>
            <button
              type="button"
              className="primary-btn small"
              disabled={playingSeq}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              <Upload size={14} /> Import
            </button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={importSequences} hidden />
          </div>

          <small className="motion-sequence-status" role="status">
            {playingSeq
              ? 'Playing step ' + (playingIndex + 1) + ' of ' + sequence.steps.length
              : sequence.steps.length + (sequence.steps.length === 1 ? ' step' : ' steps') + ', ' + totalSeconds + ' seconds total'}
            {notice ? ' | ' + notice : ''}
          </small>
        </section>
      ) : null}
    </div>
  )
}