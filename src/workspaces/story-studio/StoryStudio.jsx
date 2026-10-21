import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, BookOpen, Copy, Plus, Trash2 } from 'lucide-react'
import { createScene, createStory, loadStories, saveStories } from '../../lib/story-store.js'
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

function backgroundOf(name) {
  return BACKGROUNDS[name] || BACKGROUNDS.sunset
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

  useEffect(
    function persist() {
      saveStories(stories)
    },
    [stories],
  )

  const story = stories.find((item) => item.id === storyId) || stories[0]
  const scene = story.scenes.find((item) => item.id === sceneId) || story.scenes[0]
  const sceneIndex = story.scenes.indexOf(scene)
  const look = backgroundOf(scene.background)

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

  function addStory() {
    const next = createStory({ title: 'Story ' + (stories.length + 1) })
    setStories([...stories, next])
    setStoryId(next.id)
    setSceneId(next.scenes[0].id)
  }

  function openStory(id) {
    const target = stories.find((item) => item.id === id)
    setStoryId(id)
    setSceneId(target.scenes[0].id)
  }

  function deleteStory() {
    if (!window.confirm('Delete "' + story.title + '"?')) return
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
    const rest = story.scenes.filter((item) => item.id !== scene.id)
    changeStory((item) => ({ ...item, scenes: rest }))
    setSceneId(rest[Math.max(0, sceneIndex - 1)].id)
  }

  function moveScene(direction) {
    const target = sceneIndex + direction
    if (target < 0 || target >= story.scenes.length) return
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
                    {item.characterId ? (
                      <span className="thumb-character">
                        <span className="thumb-hair" />
                        <span className="thumb-head" />
                        <span className="thumb-body" />
                      </span>
                    ) : null}
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

          <div
            className="story-stage"
            style={{ background: 'linear-gradient(180deg,' + look.sky1 + ',' + look.sky2 + ')' }}
          >
            {scene.characterId ? (
              <span className="thumb-character" style={{ transform: 'translateX(-50%) scale(2.4)', transformOrigin: 'bottom' }}>
                <span className="thumb-hair" />
                <span className="thumb-head" />
                <span className="thumb-body" />
              </span>
            ) : null}
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
                <option key={item.id} value={item.id}>{item.name || item.title || 'Unnamed character'}</option>
              ))}
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