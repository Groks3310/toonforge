import { useEffect, useMemo, useState } from 'react'
import { Copy, Plus, Sparkles, Trash2 } from 'lucide-react'
import { createCharacter, loadCharacters, saveCharacters } from '../../lib/character-store.js'
import './character-studio.css'

const EXPRESSION_OPTIONS = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'happy', label: 'Happy' },
  { id: 'sad', label: 'Sad' },
  { id: 'angry', label: 'Angry' },
  { id: 'surprised', label: 'Surprised' },
]

const BODY_OPTIONS = [
  { id: 'classic', label: 'Classic' },
  { id: 'slim', label: 'Slim' },
  { id: 'wide', label: 'Wide' },
]

const OUTFIT_OPTIONS = [
  { id: 'hero', label: 'Hero outfit' },
  { id: 'casual', label: 'Casual' },
  { id: 'formal', label: 'Formal' },
]

const ACCESSORIES = [
  { id: 'none', label: 'None' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'hat', label: 'Hat' },
  { id: 'cape', label: 'Cape' },
]

export function CharacterStudio() {
  const [characters, setCharacters] = useState(function initial() {
    return loadCharacters()
  })
  const [selectedId, setSelectedId] = useState(function initial() {
    const list = loadCharacters()
    return list[0]?.id || ''
  })

  useEffect(
    function persist() {
      saveCharacters(characters)
    },
    [characters],
  )

  const selectedCharacter = useMemo(
    function findSelected() {
      return characters.find((character) => character.id === selectedId) || characters[0] || null
    },
    [characters, selectedId],
  )

  function updateSelected(field, value) {
    if (!selectedCharacter) {
      return
    }
    setCharacters(function mapCharacters(current) {
      return current.map((character) => {
        if (character.id !== selectedCharacter.id) {
          return character
        }
        return { ...character, [field]: value }
      })
    })
  }

  function addCharacter() {
    const next = createCharacter({
      name: `Character ${characters.length + 1}`,
      expression: 'happy',
    })
    setCharacters(function addCurrent(current) {
      return [next, ...current]
    })
    setSelectedId(next.id)
  }

  function duplicateCharacter(character) {
    const duplicate = createCharacter({
      ...character,
      id: undefined,
      name: `${character.name} Copy`,
      favorite: false,
    })
    setCharacters(function addCurrent(current) {
      return [duplicate, ...current]
    })
    setSelectedId(duplicate.id)
  }

  function removeCharacter(characterId) {
    setCharacters(function removeCurrent(current) {
      if (current.length <= 1) {
        const replacement = createCharacter({ name: 'Nova' })
        setSelectedId(replacement.id)
        return [replacement]
      }

      const remaining = current.filter((character) => character.id !== characterId)
      if (selectedId === characterId) {
        setSelectedId(remaining[0].id)
      }
      return remaining
    })
  }

  if (!selectedCharacter) {
    return null
  }

  return (
    <div className="character-studio">
      <div className="section-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h3>Character Studio</h3>
          <p>Reusable cartoon characters stay on this device and can be reused later.</p>
        </div>
      </div>

      <div className="character-layout">
        <aside className="panel character-gallery-panel">
          <div className="gallery-toolbar">
            <h3>Characters</h3>
            <button type="button" className="primary-btn small" onClick={addCharacter}>
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="character-gallery">
            {characters.map((character) => {
              const active = character.id === selectedCharacter.id
              return (
                <button
                  key={character.id}
                  type="button"
                  className={active ? 'character-card active' : 'character-card'}
                  onClick={function select() {
                    setSelectedId(character.id)
                  }}
                >
                  <div className="mini-avatar" aria-hidden="true">
                    <span style={{ background: character.hairColor }} />
                    <span style={{ background: character.skinTone }} />
                    <span style={{ background: character.outfitColor }} />
                  </div>
                  <div className="character-card-copy">
                    <strong>{character.name}</strong>
                    <small>{character.expression}</small>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="panel character-main-panel">
          <div className="character-topbar">
            <div className="editable-name">
              <label htmlFor="character-name">Name</label>
              <input
                id="character-name"
                type="text"
                value={selectedCharacter.name}
                onChange={function change(event) {
                  updateSelected('name', event.target.value)
                }}
              />
            </div>
            <div className="quick-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={function clone() {
                  duplicateCharacter(selectedCharacter)
                }}
              >
                <Copy size={14} /> Duplicate
              </button>
              <button
                type="button"
                className="ghost-btn danger"
                onClick={function remove() {
                  removeCharacter(selectedCharacter.id)
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>

          <div className="character-preview-wrap">
            <div className={`character-preview expression-${selectedCharacter.expression} body-${selectedCharacter.body}`}>
              <div className="character-scene">
                <div className="character-shadow" />
                <div className="character-figure" style={{ '--skin-tone': selectedCharacter.skinTone, '--hair-color': selectedCharacter.hairColor, '--eye-color': selectedCharacter.eyeColor, '--outfit-color': selectedCharacter.outfitColor, '--accent-color': selectedCharacter.accentColor }}>
                  <div className="character-hair" />
                  <div className="character-head">
                    <div className="character-eye left" />
                    <div className="character-eye right" />
                    <div className="character-mouth" />
                    {selectedCharacter.accessory === 'glasses' ? <div className="character-glasses" /> : null}
                    {selectedCharacter.accessory === 'hat' ? <div className="character-hat" /> : null}
                  </div>
                  <div className="character-body">
                    <div className="character-arm left" />
                    <div className="character-arm right" />
                    {selectedCharacter.accessory === 'cape' ? <div className="character-cape" /> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="character-controls">
            <div className="control-block">
              <h4>Appearance</h4>

              <label className="field inline-two">
                <span>Skin tone</span>
                <input
                  type="color"
                  value={selectedCharacter.skinTone}
                  onChange={function change(event) {
                    updateSelected('skinTone', event.target.value)
                  }}
                />
              </label>

              <label className="field inline-two">
                <span>Hair</span>
                <input
                  type="color"
                  value={selectedCharacter.hairColor}
                  onChange={function change(event) {
                    updateSelected('hairColor', event.target.value)
                  }}
                />
              </label>

              <label className="field inline-two">
                <span>Eyes</span>
                <input
                  type="color"
                  value={selectedCharacter.eyeColor}
                  onChange={function change(event) {
                    updateSelected('eyeColor', event.target.value)
                  }}
                />
              </label>

              <label className="field inline-two">
                <span>Outfit</span>
                <input
                  type="color"
                  value={selectedCharacter.outfitColor}
                  onChange={function change(event) {
                    updateSelected('outfitColor', event.target.value)
                  }}
                />
              </label>

              <label className="field inline-two">
                <span>Accent</span>
                <input
                  type="color"
                  value={selectedCharacter.accentColor}
                  onChange={function change(event) {
                    updateSelected('accentColor', event.target.value)
                  }}
                />
              </label>
            </div>

            <div className="control-block">
              <h4>Character setup</h4>

              <label className="field">
                <span>Expression</span>
                <select
                  value={selectedCharacter.expression}
                  onChange={function change(event) {
                    updateSelected('expression', event.target.value)
                  }}
                >
                  {EXPRESSION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Body shape</span>
                <select
                  value={selectedCharacter.body}
                  onChange={function change(event) {
                    updateSelected('body', event.target.value)
                  }}
                >
                  {BODY_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Outfit style</span>
                <select
                  value={selectedCharacter.outfitStyle}
                  onChange={function change(event) {
                    updateSelected('outfitStyle', event.target.value)
                  }}
                >
                  {OUTFIT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Accessory</span>
                <select
                  value={selectedCharacter.accessory}
                  onChange={function change(event) {
                    updateSelected('accessory', event.target.value)
                  }}
                >
                  {ACCESSORIES.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="notice-panel">
            <Sparkles size={16} />
            <p>This is a simple local character system. It is a foundation for future rigged 3D characters and reusable templates.</p>
          </div>
        </section>
      </div>
    </div>
  )
}
