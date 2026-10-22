import { useEffect, useRef } from 'react'
import { ArrowLeft, ArrowRight, Copy, Plus, Trash2 } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton.jsx'
import { CharacterFigure } from './CharacterFigure.jsx'

export function SceneFilmstrip({
  scenes,
  selectedId,
  backgroundOf,
  findCharacter,
  onSelect,
  onAdd,
  onDuplicate,
  onMove,
  onDelete,
}) {
  const stripRef = useRef(null)
  const selectedIndex = scenes.findIndex((item) => item.id === selectedId)

  // Keeps the current scene visible, including while a story plays.
  useEffect(
    function keepVisible() {
      const strip = stripRef.current
      const card = strip && strip.querySelector('[aria-current="true"]')
      if (card && card.scrollIntoView) {
        card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      }
    },
    [selectedId],
  )

  return (
    <section className="panel ss-filmstrip" aria-label="Scenes">
      <div className="ss-filmstrip-head">
        <h3>
          Scenes <span className="ss-count">{scenes.length}</span>
        </h3>
        <div className="ss-icon-row">
          <IconButton label="Move scene earlier" disabled={selectedIndex <= 0} onClick={() => onMove(-1)}>
            <ArrowLeft size={16} />
          </IconButton>
          <IconButton
            label="Move scene later"
            disabled={selectedIndex === scenes.length - 1}
            onClick={() => onMove(1)}
          >
            <ArrowRight size={16} />
          </IconButton>
          <IconButton label="Duplicate scene" onClick={onDuplicate}>
            <Copy size={16} />
          </IconButton>
          <IconButton label="Delete scene" danger disabled={scenes.length === 1} onClick={onDelete}>
            <Trash2 size={16} />
          </IconButton>
        </div>
      </div>

      <div className="ss-strip" ref={stripRef}>
        {scenes.map(function renderScene(item, index) {
          const look = backgroundOf(item.background)
          const figures = item.cast.map((member) => findCharacter(member.characterId)).filter(Boolean).slice(0, 3)
          return (
            <button
              key={item.id}
              type="button"
              className="ss-card"
              aria-current={item.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(item.id)}
            >
              <span
                className="ss-thumb"
                style={{ background: 'linear-gradient(135deg,' + look.sky1 + ',' + look.sky2 + ')' }}
              >
                {figures.map((character, position) => (
                  <CharacterFigure key={position} character={character} index={position} total={figures.length} />
                ))}
              </span>
              <span className="ss-card-title">
                {index + 1}. {item.title}
              </span>
              <span className="ss-card-meta">{item.mood}</span>
            </button>
          )
        })}
        <button type="button" className="ss-card ss-card-add" onClick={onAdd} aria-label="Add scene">
          <Plus size={20} />
          <span>Add scene</span>
        </button>
      </div>
    </section>
  )
}