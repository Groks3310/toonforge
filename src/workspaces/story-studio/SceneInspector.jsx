import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { LINE_EXPRESSIONS } from '../../lib/story-store.js'
import { IconButton } from '../../components/ui/IconButton.jsx'
import { BACKGROUNDS, MOODS } from './story-options.js'

const TABS = [
  { id: 'scene', label: 'Scene' },
  { id: 'cast', label: 'Cast' },
  { id: 'dialogue', label: 'Dialogue' },
]
const PAUSES = [0, 0.5, 1, 2, 3]

export function SceneInspector({
  scene,
  characters,
  findCharacter,
  castCharacterIds,
  activeLineId,
  selectedLineId,
  onSelectLine,
  onChangeScene,
  onUpdateCast,
  onAddCast,
  onRemoveCast,
  onUpdateLine,
  onAddLine,
  onRemoveLine,
  onMoveLine,
}) {
  const [tab, setTab] = useState('scene')
  const selectedLine = scene.lines.find((line) => line.id === selectedLineId) || null
  const selectedIndex = selectedLine ? scene.lines.indexOf(selectedLine) : -1
  const counts = { scene: null, cast: scene.cast.length, dialogue: scene.lines.length }

  return (
    <aside className="panel ss-inspector">
      <div className="tf-tabs" role="tablist" aria-label="Scene settings">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={'ss-tab-' + item.id}
            aria-selected={tab === item.id}
            aria-controls="ss-tabpanel"
            className="tf-tab"
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {counts[item.id] !== null ? <span className="ss-count">{counts[item.id]}</span> : null}
          </button>
        ))}
      </div>

      <div className="ss-tabpanel" id="ss-tabpanel" role="tabpanel" aria-labelledby={'ss-tab-' + tab}>
        {tab === 'scene' ? (
          <>
            <div className="ss-field">
              <label htmlFor="scene-title">Title</label>
              <input
                id="scene-title"
                className="ss-control"
                value={scene.title}
                onChange={(event) => onChangeScene({ title: event.target.value })}
              />
            </div>
            <div className="ss-field">
              <span className="ss-label" id="scene-bg-label">Background</span>
              <div className="ss-swatches" role="group" aria-labelledby="scene-bg-label">
                {Object.keys(BACKGROUNDS).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="ss-swatch"
                    aria-pressed={scene.background === key}
                    onClick={() => onChangeScene({ background: key })}
                  >
                    <span
                      className="ss-swatch-chip"
                      style={{
                        background: 'linear-gradient(135deg,' + BACKGROUNDS[key].sky1 + ',' + BACKGROUNDS[key].sky2 + ')',
                      }}
                    />
                    {BACKGROUNDS[key].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ss-field">
              <label htmlFor="scene-mood">Mood</label>
              <select
                id="scene-mood"
                className="ss-control"
                value={scene.mood}
                onChange={(event) => onChangeScene({ mood: event.target.value })}
              >
                {MOODS.map((mood) => (
                  <option key={mood} value={mood}>{mood}</option>
                ))}
              </select>
            </div>
            <div className="ss-field">
              <label htmlFor="scene-notes">Notes</label>
              <textarea
                id="scene-notes"
                className="ss-control"
                value={scene.notes}
                onChange={(event) => onChangeScene({ notes: event.target.value })}
              />
            </div>
          </>
        ) : null}

        {tab === 'cast' ? (
          <>
            {scene.cast.length === 0 ? (
              <div className="ss-empty">
                {characters.length === 0
                  ? 'No characters yet. Create one in Character Studio, then cast it here.'
                  : 'Nobody is on stage yet.'}
              </div>
            ) : null}
            {scene.cast.map(function renderMember(member, index) {
              const character = findCharacter(member.characterId)
              return (
                <div className="ss-box" key={member.id}>
                  <div className="ss-cast-top">
                    <span className="ss-dot" style={{ background: character ? character.outfitColor : 'transparent' }} />
                    <select
                      className="ss-control"
                      aria-label={'Character ' + (index + 1)}
                      value={member.characterId}
                      onChange={(event) => onUpdateCast(member.id, { characterId: event.target.value })}
                    >
                      <option value="">Choose a character</option>
                      {characters.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                      {member.characterId && !character ? (
                        <option value={member.characterId}>Deleted character</option>
                      ) : null}
                    </select>
                    <IconButton
                      label={'Remove character ' + (index + 1) + ' from the stage'}
                      danger
                      onClick={() => onRemoveCast(member.id)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                  <div className="ss-field">
                    <label htmlFor={'face-' + member.id}>Default face</label>
                    <select
                      id={'face-' + member.id}
                      className="ss-control"
                      value={member.face}
                      onChange={(event) => onUpdateCast(member.id, { face: event.target.value })}
                    >
                      {LINE_EXPRESSIONS.map((name) => (
                        <option key={name} value={name}>
                          {name === 'auto' ? 'Follow the mood' : name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )
            })}
            <button type="button" className="tf-btn" disabled={characters.length === 0} onClick={onAddCast}>
              <Plus size={16} /> Add character
            </button>
          </>
        ) : null}

        {tab === 'dialogue' ? (
          <>
            {scene.lines.length === 0 ? <div className="ss-empty">No lines yet. Add the first one.</div> : null}
            {scene.lines.length > 0 ? (
              <ul className="ss-lines">
                {scene.lines.map(function renderLine(line, index) {
                  const speaker = findCharacter(line.characterId)
                  const classes = line.id === activeLineId ? 'ss-line live' : 'ss-line'
                  return (
                    <li key={line.id}>
                      <button
                        type="button"
                        className={classes}
                        aria-current={selectedLine && line.id === selectedLine.id ? 'true' : undefined}
                        onClick={() => onSelectLine(line.id)}
                      >
                        <span className="ss-line-n">{index + 1}</span>
                        <span className="ss-line-body">
                          <strong>{speaker ? speaker.name : 'Narrator'}</strong>
                          <span>{line.text.trim() || 'Empty line'}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}

            {selectedLine ? (
              <div className="ss-box">
                <div className="ss-field">
                  <label htmlFor="line-speaker">Speaker</label>
                  <select
                    id="line-speaker"
                    className="ss-control"
                    value={selectedLine.characterId}
                    onChange={(event) => onUpdateLine(selectedLine.id, { characterId: event.target.value })}
                  >
                    <option value="">Narrator (no character)</option>
                    {castCharacterIds.map((id) => (
                      <option key={id} value={id}>
                        {findCharacter(id) ? findCharacter(id).name : 'Deleted character'}
                      </option>
                    ))}
                    {selectedLine.characterId && !castCharacterIds.includes(selectedLine.characterId) ? (
                      <option value={selectedLine.characterId}>
                        Not on stage: {findCharacter(selectedLine.characterId) ? findCharacter(selectedLine.characterId).name : 'deleted character'}
                      </option>
                    ) : null}
                  </select>
                </div>
                <div className="ss-field">
                  <label htmlFor="line-text">Text</label>
                  <textarea
                    id="line-text"
                    className="ss-control"
                    value={selectedLine.text}
                    onChange={(event) => onUpdateLine(selectedLine.id, { text: event.target.value })}
                  />
                </div>
                <div className="ss-row">
                  <div className="ss-field ss-grow">
                    <label htmlFor="line-face">Robot face</label>
                    <select
                      id="line-face"
                      className="ss-control"
                      value={selectedLine.expression}
                      onChange={(event) => onUpdateLine(selectedLine.id, { expression: event.target.value })}
                    >
                      {LINE_EXPRESSIONS.map((name) => (
                        <option key={name} value={name}>{name === 'auto' ? 'Auto (from mood)' : name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ss-field ss-grow">
                    <label htmlFor="line-pause">Pause after</label>
                    <select
                      id="line-pause"
                      className="ss-control"
                      value={selectedLine.pause}
                      onChange={(event) => onUpdateLine(selectedLine.id, { pause: Number(event.target.value) })}
                    >
                      {PAUSES.map((seconds) => (
                        <option key={seconds} value={seconds}>{seconds} s</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="ss-row ss-row-end">
                  <IconButton label="Move line up" disabled={selectedIndex === 0} onClick={() => onMoveLine(selectedIndex, -1)}>
                    <ArrowUp size={16} />
                  </IconButton>
                  <IconButton
                    label="Move line down"
                    disabled={selectedIndex === scene.lines.length - 1}
                    onClick={() => onMoveLine(selectedIndex, 1)}
                  >
                    <ArrowDown size={16} />
                  </IconButton>
                  <IconButton label="Remove line" danger onClick={() => onRemoveLine(selectedLine.id)}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
            ) : null}

            <button type="button" className="tf-btn" onClick={onAddLine}>
              <Plus size={16} /> Add line
            </button>
          </>
        ) : null}
      </div>
    </aside>
  )
}