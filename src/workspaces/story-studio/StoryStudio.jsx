import { useEffect, useRef, useState } from 'react'
import { Download, Play, Plus, Square, Trash2, Upload } from 'lucide-react'
import {
  createCastMember,
  createLine,
  createScene,
  createStory,
  loadStories,
  normalizeStory,
  saveStories,
} from '../../lib/story-store.js'
import { loadCharacters } from '../../lib/character-store.js'
import { createTextMouth } from '../../lib/lip-sync.js'
import { IconButton } from '../../components/ui/IconButton.jsx'
import { MOOD_EXPRESSION, backgroundOf } from './story-options.js'
import { SPEECH_SUPPORTED, pitchFor, readingTime, speakLine, wait } from './story-speech.js'
import { StagePreview } from './StagePreview.jsx'
import { SceneFilmstrip } from './SceneFilmstrip.jsx'
import { SceneInspector } from './SceneInspector.jsx'
import '../../styles/ui-kit.css'
import '../motion-studio/motion-studio.css'
import './story-studio.css'

export function StoryStudio({ initialStoryId = null }) {
  const [characters] = useState(loadCharacters)
  const [stories, setStories] = useState(loadStories)
  const [storyId, setStoryId] = useState(function pickStory() {
    return (stories.find((item) => item.id === initialStoryId) || stories[0]).id
  })
  const [sceneId, setSceneId] = useState(function pickScene() {
    return (stories.find((item) => item.id === initialStoryId) || stories[0]).scenes[0].id
  })
  
  const [playing, setPlaying] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [notice, setNotice] = useState('')
  const [view, setView] = useState('2d')
  const [activeLineId, setActiveLineId] = useState(null) // the line being spoken during playback
  const [selectedLineId, setSelectedLineId] = useState(null) // the line open in the editor
  const runRef = useRef(0)
  const fileInputRef = useRef(null)
  const talkRef = useRef(0) // mouth level (0 to 1) read by the 3D robot every frame
  const textMouthRef = useRef(null)

  useEffect(
    function persist() {
      saveStories(stories)
    },
    [stories],
  )

  useEffect(function setupMouth() {
    const textMouth = createTextMouth(function setLevel(level) {
      talkRef.current = level === null ? 0 : level
    })
    textMouthRef.current = textMouth
    return function cleanup() {
      textMouth.stop()
    }
  }, [])

  // Stop any speech and playback loop when leaving Story Studio.
  useEffect(function cleanup() {
    return function stopOnLeave() {
      runRef.current += 1
      if (SPEECH_SUPPORTED) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  useEffect(
    function clearNotice() {
      if (!notice) return undefined
      const timer = setTimeout(() => setNotice(''), 4000)
      return () => clearTimeout(timer)
    },
    [notice],
  )

  function findCharacter(id) {
    return characters.find((item) => item.id === id)
  }

  const story = stories.find((item) => item.id === storyId) || stories[0]
  const scene = story.scenes.find((item) => item.id === sceneId) || story.scenes[0]
  const sceneIndex = story.scenes.indexOf(scene)
  const look = backgroundOf(scene.background)
  // Everyone on stage. Someone whose character was deleted is skipped.
  const castOnStage = scene.cast
    .map((member) => ({ member, character: findCharacter(member.characterId) }))
    .filter((entry) => entry.character)
  const castCharacterIds = [...new Set(scene.cast.map((member) => member.characterId).filter(Boolean))]

  // While a story plays, the spoken line drives the preview. Otherwise the line open in the editor does.
  const selectedLine = scene.lines.find((line) => line.id === selectedLineId) || scene.lines[0] || null
  const previewLine = scene.lines.find((line) => line.id === activeLineId) || selectedLine
  const speakerCharacter = previewLine ? findCharacter(previewLine.characterId) : undefined
  const speakerEntry = speakerCharacter
    ? castOnStage.find((entry) => entry.member.characterId === speakerCharacter.id)
    : undefined
  const speakerMemberId = speakerEntry ? speakerEntry.member.id : ''
  const moodFace = MOOD_EXPRESSION[scene.mood] || 'auto'

  // Face order: the line's own face (for the speaker), then the character's default face, then the mood.
  function faceFor(member) {
    if (member.id === speakerMemberId && previewLine && previewLine.expression !== 'auto') {
      return previewLine.expression
    }
    return member.face !== 'auto' ? member.face : moodFace
  }

  const actors = castOnStage.map((entry) => ({
    id: entry.member.id,
    colors: {
      outfit: entry.character.outfitColor,
      accent: entry.character.accentColor,
      eyes: entry.character.eyeColor,
    },
    expression: faceFor(entry.member),
  }))

  const caption =
    previewLine && previewLine.text.trim()
      ? { speaker: speakerCharacter ? speakerCharacter.name : 'Narrator', text: previewLine.text.trim() }
      : null

  function stopMouth() {
    if (textMouthRef.current) {
      textMouthRef.current.stop()
    }
  }

  function stopStory() {
    runRef.current += 1
    if (SPEECH_SUPPORTED) {
      window.speechSynthesis.cancel()
    }
    stopMouth()
    setSpeaking(false)
    setActiveLineId(null)
    setPlaying(false)
  }

  async function playStory(startIndex) {
    const token = runRef.current + 1
    runRef.current = token
    if (SPEECH_SUPPORTED) {
      window.speechSynthesis.cancel()
    }
    setPlaying(true)

    const mouthHandlers = {
      onWord: function onWord(word) {
        if (textMouthRef.current) textMouthRef.current.word(word, 1)
      },
      onFallback: function onFallback(text) {
        if (textMouthRef.current) textMouthRef.current.word(text, 1)
      },
    }

    for (let i = startIndex; i < story.scenes.length; i += 1) {
      if (runRef.current !== token) return
      const item = story.scenes[i]
      setSceneId(item.id)

      if (item.lines.length === 0) {
        setActiveLineId(null)
        await wait(2000)
      }

      for (let j = 0; j < item.lines.length; j += 1) {
        if (runRef.current !== token) return
        const line = item.lines[j]
        const text = line.text.trim()
        const speaker = findCharacter(line.characterId)
        setActiveLineId(line.id)

        if (text) {
          // Narrator lines are spoken without moving a character's mouth.
          setSpeaking(Boolean(speaker))
          const finished = await speakLine(text, speaker ? mouthHandlers : null, pitchFor(line.characterId))
          stopMouth()
          setSpeaking(false)
          if (runRef.current !== token) return
          if (!finished) {
            // No voice available: move the mouth across the text while we wait.
            if (speaker && textMouthRef.current) textMouthRef.current.word(text, 1)
            await wait(readingTime(text))
            stopMouth()
          }
        } else {
          await wait(800)
        }

        if (runRef.current !== token) return
        await wait(Math.max(0.2, line.pause) * 1000)
      }

      if (runRef.current !== token) return
      await wait(400)
    }

    if (runRef.current === token) {
      setActiveLineId(null)
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

  // Who is on stage. characterId and characterIds are kept in step for older data.
  function changeCast(change) {
    const cast = change(scene.cast)
    const ids = [...new Set(cast.map((member) => member.characterId).filter(Boolean))]
    changeScene({ cast, characterId: ids[0] || '', characterIds: ids })
  }

  function updateCast(id, patch) {
    changeCast((cast) => cast.map((member) => (member.id === id ? { ...member, ...patch } : member)))
  }

  function addCastMember() {
    // Pick a character who is not on stage yet, if there is one.
    const next = characters.find((item) => !scene.cast.some((member) => member.characterId === item.id)) || characters[0]
    changeCast((cast) => [...cast, createCastMember({ characterId: next ? next.id : '' })])
  }

  function removeCastMember(id) {
    changeCast((cast) => cast.filter((member) => member.id !== id))
  }

  // Dialogue lines. scene.dialogue is kept equal to all the lines joined together.
  function changeLines(change) {
    const lines = change(scene.lines)
    changeScene({ lines, dialogue: lines.map((line) => line.text.trim()).filter(Boolean).join(' ') })
  }

  function updateLine(id, patch) {
    changeLines((lines) => lines.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  }

  function addLine() {
    const last = scene.lines[scene.lines.length - 1]
    const line = createLine({ characterId: last ? last.characterId : castCharacterIds[0] || '' })
    changeLines((lines) => [...lines, line])
    setSelectedLineId(line.id)
  }

  function removeLine(id) {
    changeLines((lines) => lines.filter((line) => line.id !== id))
  }

  function moveLine(index, direction) {
    const target = index + direction
    if (target < 0 || target >= scene.lines.length) return
    changeLines(function apply(lines) {
      const next = [...lines]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
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
    if (!window.confirm('Delete "' + scene.title + '"?')) return
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
    <div className="ss">
      <header className="panel ss-header">
        <input
          className="ss-title-input"
          aria-label="Story title"
          value={story.title}
          onChange={(event) => changeStory((item) => ({ ...item, title: event.target.value }))}
        />
        <div className="ss-header-actions">
          <select
            className="ss-control ss-select"
            aria-label="Choose a story"
            value={story.id}
            onChange={(event) => openStory(event.target.value)}
          >
            {stories.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
          <button type="button" className="tf-btn" onClick={addStory}>
            <Plus size={16} /> New story
          </button>
          <IconButton label="Export all stories" onClick={exportStories}>
            <Download size={16} />
          </IconButton>
          <IconButton label="Import stories" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
            <Upload size={16} />
          </IconButton>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={importStories} hidden />
          <IconButton label="Delete story" danger onClick={deleteStory}>
            <Trash2 size={16} />
          </IconButton>
        </div>
      </header>

      {notice ? (
        <div className="ss-notice" role="status">{notice}</div>
      ) : null}

      <div className="ss-body">
        <section className="ss-main">
          <StagePreview
            view={view}
            look={look}
            cast={castOnStage}
            actors={actors}
            speakerMemberId={speakerMemberId}
            speaking={speaking}
            talkRef={talkRef}
            caption={caption}
            hasCharacters={characters.length > 0}
          />

          <div className="ss-transport">
            {playing ? (
              <button type="button" className="tf-btn tf-btn--primary" onClick={stopStory}>
                <Square size={16} /> Stop
              </button>
            ) : (
              <>
                <button type="button" className="tf-btn tf-btn--primary" onClick={() => playStory(0)}>
                  <Play size={16} /> Play story
                </button>
                <button type="button" className="tf-btn" onClick={() => playStory(sceneIndex)}>
                  <Play size={16} /> From scene {sceneIndex + 1}
                </button>
              </>
            )}
            <span className="ss-status" role="status">
              {playing
                ? 'Playing scene ' + (sceneIndex + 1) + ' of ' + story.scenes.length
                : story.scenes.length + (story.scenes.length === 1 ? ' scene' : ' scenes')}
            </span>
            <span className="ss-transport-spacer" />
            <div className="seg" role="group" aria-label="Preview type">
              <button type="button" className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')}>
                3D robot
              </button>
              <button type="button" className={view === '2d' ? 'active' : ''} onClick={() => setView('2d')}>
                2D character
              </button>
            </div>
          </div>
          {!SPEECH_SUPPORTED ? (
            <small className="ss-status">
              This browser cannot speak text, so scenes will advance on a reading-time estimate.
            </small>
          ) : null}

          <SceneFilmstrip
            scenes={story.scenes}
            selectedId={scene.id}
            backgroundOf={backgroundOf}
            findCharacter={findCharacter}
            onSelect={setSceneId}
            onAdd={addScene}
            onDuplicate={duplicateScene}
            onMove={moveScene}
            onDelete={deleteScene}
          />
        </section>

        <SceneInspector
          scene={scene}
          characters={characters}
          findCharacter={findCharacter}
          castCharacterIds={castCharacterIds}
          activeLineId={activeLineId}
          selectedLineId={selectedLine ? selectedLine.id : null}
          onSelectLine={setSelectedLineId}
          onChangeScene={changeScene}
          onUpdateCast={updateCast}
          onAddCast={addCastMember}
          onRemoveCast={removeCastMember}
          onUpdateLine={updateLine}
          onAddLine={addLine}
          onRemoveLine={removeLine}
          onMoveLine={moveLine}
        />
      </div>
    </div>
  )
}