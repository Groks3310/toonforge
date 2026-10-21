import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, BookOpen, Copy, Download, Play, Plus, Square, Trash2, Upload } from 'lucide-react'
import { createScene, createStory, loadStories, normalizeStory, saveStories } from '../../lib/story-store.js'
import { loadCharacters } from '../../lib/character-store.js'
import './story-studio.css'

const BACKGROUNDS = {
  sunset: { label: 'Sunset', sky1: '#1d2433', sky2: '#ef8a53' },
  forest: { label: 'Forest', sky1: '#1f4d3a', sky2: '#8fc78a' },
  night: { label: 'Night', sky1: '#0b1020', sky2: '#3b4a7a' },
  ocean: { label: 'Ocean', sky1: '#12395c', sky2: '#5fb7d4' },
  studio: { label: 'Studio', sky1: '#2a2a33', sky2: '#6b6b7a' },
}

const MOODS = ['hopeful', 'happy', 'sad', 'tense', 'funny']
const SPEECH_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window

function backgroundOf(name) {
  return BACKGROUNDS[name] || BACKGROUNDS.sunset
}

function wait(ms) {
  return new Promise(function run(resolve) {
    setTimeout(resolve, ms)
  })
}

// Used when the browser cannot speak: estimate how long the text takes to read.
function readingTime(text) {
  return Math.max(1500, text.split(/\s+/).length * 400)
}

// Resolves true when the line finished, false if speech failed or was cancelled.
function speakLine(text) {
  return new Promise(function run(resolve) {
    if (!SPEECH_SUPPORTED) {
      resolve(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = function end() {
      resolve(true)
    }
    utterance.onerror = function fail() {
      resolve(false)
    }
    window.speechSynthesis.speak(utterance)
  })
}

// Maps a saved character onto the CSS variables used by .thumb-character.
function CharacterFigure({ character, large, speaking }) {
  const style = {
    '--skin-tone': character.skinTone,
    '--hair-color': character.hairColor,
    '--eye-color': character.eyeColor,
    '--outfit-color': character.outfitColor,
  }
  if (large) {
    style.bottom = 80
    style.transform = 'translateX(-50%) scale(2.4)'
    style.transformOrigin = 'bottom'
  }
  return (
    <span className="thumb-character" style={style}>
      <span className="thumb-hair" />
      <span className="thumb-head" />
      {large ? <span className={speaking ? 'thumb-mouth talking' : 'thumb-mouth'} /> : null}
      <span className="thumb-body" />
    </span>
  )
}

export function StoryStudio() {
  const [characters] = useState(loadCharacters)
  const [stories, setStories] = useState(loadStories)
  const [storyId, setStoryId] = useState(function pickFirstStory() {
    return stories[0].id
  })
  const [sceneId, setSceneId] = useState(function pickFirstScene() {
    return stories[0].scenes[0].id
  })
  const [playing, setPlaying] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [notice, setNotice] = useState('')
  const runRef = useRef(0)
  const fileInputRef = useRef(null)

  useEffect(
    function persist() {
      saveStories(stories)
    },
    [stories],
  )

  // Stop any speech and playback loop when leaving Story Studio.
  useEffect(function cleanup() {
    return function stopOnLeave() {
      runRef.current += 1
      if (SPEECH_SUPPORTED) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  function findCharacter(id) {
    return characters.find((item) => item.id === id)
  }

  const story = stories.find((item) => item.id === storyId) || stories[0]
  const scene = story.scenes.find((item) => item.id === sceneId) || story.scenes[0]
  const sceneIndex = story.scenes.indexOf(scene)
  const look = backgroundOf(scene.background)
  const sceneCharacter = findCharacter(scene.characterId)

  function stopStory() {
    runRef.current += 1
    if (SPEECH_SUPPORTED) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
    setPlaying(false)
  }

  async function playStory(startIndex) {
    const token = runRef.current + 1
    runRef.current = token
    if (SPEECH_SUPPORTED) {
      window.speechSynthesis.cancel()
    }
    setPlaying(true)

    for (let i = startIndex; i < story.scenes.length; i += 1) {
      if (runRef.current !== token) return
      const item = story.scenes[i]
      setSceneId(item.id)
      const text = (item.dialogue || '').trim()

      if (text) {
        setSpeaking(true)
        const finished = await speakLine(text)
        setSpeaking(false)
        if (runRef.current !== token) return
        if (!finished) {
          await wait(readingTime(text))
        }
      } else {
        await wait(2000)
      }

      if (runRef.current !== token) return
      await wait(400)
    }

    if (runRef.current === token) {
      setPlaying(false)
    }
  }

  function changeStory(change) {
    setStories(function apply(list) {
      return list.map(function each(item) {
        return item.id === story.id ? change(item) : item
      })
    })
  }

  function changeScene(patch) {
    changeStory(function apply(item) {
      return {
        ...item,
        scenes: item.scenes.map(function each(s) {
          return s.id === scene.id ? { ...s, ...patch } : s
        }),
      }
    })
  }

  function exportStories() {
    const payload = { app: 'toonforge', type: 'stories', version: 1, stories }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'toonforge-stories.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setNotice('Exported ' + stories.length + (stories.length === 1 ? ' story.' : ' stories.'))
  }

  function importStories(event) {
    const file = event.target.files && event.target.files[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setNotice('That file is too large to be a story file.')
      return
    }
    const reader = new FileReader()
    reader.onerror = function failed() {
      setNotice('Could not read that file.')
    }
    reader.onload = function loaded() {
      try {
        const data = JSON.parse(String(reader.result))
        const list = Array.isArray(data) ? data : data && Array.isArray(data.stories) ? data.stories : null
        if (!list || list.length === 0) {
          throw new Error('No stories found in this file.')
        }
        const imported = list.map(function fresh(item) {
          const clean = normalizeStory(item)
          return {
            ...clean,
            id: createStory().id,
            scenes: clean.scenes.map((s) => ({ ...s, id: createScene().id })),
          }
        })
        stopStory()
        setStories((previous) => [...previous, ...imported])
        setStoryId(imported[0].id)
        setSceneId(imported[0].scenes[0].id)
        setNotice('Imported ' + imported.length + (imported.length === 1 ? ' story.' : ' stories.'))
      } catch (error) {
        setNotice('Could not import: ' + (error.message || 'invalid file.'))
      }
    }
    reader.readAsText(file)
  }

  function addStory() {
    stopStory()
    const next = createStory({ title: 'Story ' + (stories.length + 1) })
    setStories([...stories, next])
    setStoryId(next.id)
    setSceneId(next.scenes[0].id)
  }

  function openStory(id) {
    stopStory()
    const target = stories.find((item) => item.id === id)
    setStoryId(id)
    setSceneId(target.scenes[0].id)
  }

  function deleteStory() {
    if (!window.confirm('Delete "' + story.title + '"?')) return
    stopStory()
    const rest = stories.filter((item) => item.id !== story.id)
    const next = rest.length > 0 ? rest : [createStory({ title: 'My first story' })]
    setStories(next)
    setStoryId(next[0].id)
    setSceneId(next[0].scenes[0].id)
  }

  function addScene() {
    const next = createScene({ title: 'Scene ' + (story.scenes.length + 1) })
    changeStory((item) => ({ ...item, scenes: [...item.scenes, next] }))
    setSceneId(next.id)
  }

  function duplicateScene() {
    const copy = { ...scene, id: createScene().id, title: scene.title + ' copy' }
    changeStory(function apply(item) {
      const scenes = [...item.scenes]
      scenes.splice(sceneIndex + 1, 0, copy)
      return { ...item, scenes }
    })
    setSceneId(copy.id)
  }

  function deleteScene() {
    if (story.scenes.length === 1) return
    stopStory()
    const rest = story.scenes.filter((item) => item.id !== scene.id)
    changeStory((item) => ({ ...item, scenes: rest }))
    setSceneId(rest[Math.max(0, sceneIndex - 1)].id)
  }

  function moveScene(direction) {
    const target = sceneIndex + direction
    if (target < 0 || target >= story.scenes.length) return
    stopStory()
    changeStory(function apply(item) {
      const scenes = [...item.scenes]
      const [moved] = scenes.splice(sceneIndex, 1)
      scenes.splice(target, 0, moved)
      return { ...item, scenes }
    })
  }

  return (
    <div className="story-studio">
      <div className="story-layout">
        <aside className="panel story-sidebar-panel">
          <div className="story-sidebar-toolbar">
            <h3>Stories</h3>
            <button type="button" className="primary-btn small" onClick={addStory}>
              <Plus size={14} /> New
            </button>
          </div>
          <div className="story-list">
            {stories.map(function renderStory(item) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === story.id ? 'story-card active' : 'story-card'}
                  onClick={() => openStory(item.id)}
                >
                  <span className="story-card-icon"><BookOpen size={16} /></span>
                  <span className="story-card-copy">
                    <strong>{item.title}</strong>
                    <small>{item.scenes.length} scenes</small>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="story-action-row">
            <button type="button" className="primary-btn small" onClick={exportStories}>
              <Download size={14} /> Export
            </button>
            <button
              type="button"
              className="primary-btn small"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
            >
              <Upload size={14} /> Import
            </button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={importStories} hidden />
          </div>
          {notice ? <small className="story-play-status" role="status">{notice}</small> : null}
        </aside>

        <section className="panel story-main-panel">
          <div className="story-main-header">
            <div className="editable-name">
              <label htmlFor="story-title">Story title</label>
              <input
                id="story-title"
                value={story.title}
                onChange={(event) => changeStory((item) => ({ ...item, title: event.target.value }))}
              />
            </div>
            <button type="button" className="primary-btn small" onClick={deleteStory}>
              <Trash2 size={14} /> Delete story
            </button>
          </div>

          <div className="story-scene-list">
            {story.scenes.map(function renderScene(item, index) {
              const itemLook = backgroundOf(item.background)
              const itemCharacter = findCharacter(item.characterId)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === scene.id ? 'story-scene-card active' : 'story-scene-card'}
                  onClick={() => setSceneId(item.id)}
                >
                  <span
                    className="scene-thumb"
                    style={{ background: 'linear-gradient(135deg,' + itemLook.sky1 + ',' + itemLook.sky2 + ')' }}
                  >
                    {itemCharacter ? <CharacterFigure character={itemCharacter} /> : null}
                  </span>
                  <span className="scene-copy">
                    <strong>{index + 1}. {item.title}</strong>
                    <small>{item.mood}</small>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="story-action-row">
            <button type="button" className="primary-btn small" onClick={addScene}>
              <Plus size={14} /> Add scene
            </button>
            <button type="button" className="primary-btn small" onClick={duplicateScene}>
              <Copy size={14} /> Duplicate
            </button>
            <button type="button" className="primary-btn small" onClick={() => moveScene(-1)} disabled={sceneIndex === 0}>
              <ArrowUp size={14} /> Move up
            </button>
            <button
              type="button"
              className="primary-btn small"
              onClick={() => moveScene(1)}
              disabled={sceneIndex === story.scenes.length - 1}
            >
              <ArrowDown size={14} /> Move down
            </button>
            <button type="button" className="primary-btn small" onClick={deleteScene} disabled={story.scenes.length === 1}>
              <Trash2 size={14} /> Delete scene
            </button>
          </div>

          <div className="story-action-row">
            <button type="button" className="primary-btn small" onClick={() => playStory(0)} disabled={playing}>
              <Play size={14} /> Play story
            </button>
            <button type="button" className="primary-btn small" onClick={() => playStory(sceneIndex)} disabled={playing}>
              <Play size={14} /> Play from this scene
            </button>
            <button type="button" className="primary-btn small" onClick={stopStory} disabled={!playing}>
              <Square size={14} /> Stop
            </button>
          </div>
          {playing ? (
            <small className="story-play-status">
              Playing scene {sceneIndex + 1} of {story.scenes.length}
            </small>
          ) : null}
          {!SPEECH_SUPPORTED ? (
            <small className="story-play-status">
              This browser cannot speak text, so scenes will advance on a reading-time estimate.
            </small>
          ) : null}

          <div
            className="story-stage"
            style={{ background: 'linear-gradient(180deg,' + look.sky1 + ',' + look.sky2 + ')' }}
          >
            {sceneCharacter ? <CharacterFigure character={sceneCharacter} large speaking={speaking} /> : null}
            <div
              style={{
                position: 'absolute',
                left: 16,
                right: 16,
                bottom: 16,
                padding: '12px 16px',
                borderRadius: 14,
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
              }}
            >
              {scene.dialogue || 'No dialogue yet.'}
            </div>
          </div>
        </section>

        <aside className="panel story-controls-panel">
          <h3>Scene {sceneIndex + 1}</h3>
          <div className="field">
            <label htmlFor="scene-title">Title</label>
            <input id="scene-title" value={scene.title} onChange={(event) => changeScene({ title: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="scene-bg">Background</label>
            <select id="scene-bg" value={scene.background} onChange={(event) => changeScene({ background: event.target.value })}>
              {Object.keys(BACKGROUNDS).map((key) => (
                <option key={key} value={key}>{BACKGROUNDS[key].label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="scene-character">Character</label>
            <select id="scene-character" value={scene.characterId} onChange={(event) => changeScene({ characterId: event.target.value })}>
              <option value="">None</option>
              {characters.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
              {scene.characterId && !sceneCharacter ? (
                <option value={scene.characterId}>Deleted character</option>
              ) : null}
            </select>
          </div>
          <div className="field">
            <label htmlFor="scene-mood">Mood</label>
            <select id="scene-mood" value={scene.mood} onChange={(event) => changeScene({ mood: event.target.value })}>
              {MOODS.map((mood) => (
                <option key={mood} value={mood}>{mood}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="scene-dialogue">Dialogue</label>
            <textarea id="scene-dialogue" value={scene.dialogue} onChange={(event) => changeScene({ dialogue: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="scene-notes">Notes</label>
            <textarea id="scene-notes" value={scene.notes} onChange={(event) => changeScene({ notes: event.target.value })} />
          </div>
        </aside>
      </div>
    </div>
  )
}