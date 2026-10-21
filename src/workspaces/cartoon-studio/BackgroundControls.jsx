import { useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { ACCEPTED_TYPES, GRADIENT_DIRECTIONS } from '../../lib/image-processing/cartoon.js'

const CUTOUTS = [
  { id: 'off', label: 'Keep original' },
  { id: 'smart', label: 'Smart cutout' },
  { id: 'plain', label: 'Plain backdrop' },
]

const TYPES = [
  { id: 'none', label: 'Transparent' },
  { id: 'color', label: 'Color' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'image', label: 'Image' },
]

export function BackgroundControls({
  cutout,
  tolerance,
  background,
  backgroundImageName,
  onCutoutChange,
  onToleranceChange,
  onBackgroundChange,
  onPickBackgroundImage,
  onClearBackgroundImage,
}) {
  const imageInputRef = useRef(null)

  function onImageChange(event) {
    const file = event.target.files && event.target.files[0]
    if (file) {
      onPickBackgroundImage(file)
    }
    event.target.value = ''
  }

  return (
    <div className="control-section">
      <h3>Background</h3>

      <div className="seg seg-3" role="group" aria-label="Remove the original background">
        {CUTOUTS.map(function renderCutout(item) {
          return (
            <button
              key={item.id}
              type="button"
              className={cutout === item.id ? 'active' : ''}
              onClick={function select() {
                onCutoutChange(item.id)
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      {cutout === 'plain' ? (
        <label className="field">
          <span className="field-top">
            Backdrop tolerance <span>{tolerance}</span>
          </span>
          <input
            type="range"
            min="10"
            max="120"
            value={tolerance}
            onChange={function change(event) {
              onToleranceChange(Number(event.target.value))
            }}
          />
        </label>
      ) : null}
      <p className="hint">
        {cutout === 'smart'
          ? 'A small model finds the main subject on this device. The first use loads about 18 MB, then it works offline. Fine hair and glass can get rough edges.'
          : cutout === 'plain'
            ? 'A simple color rule, not AI. It only works on a solid, light backdrop, and soft shadows can leave a pale fringe.'
            : 'Choose Smart cutout to remove the original background.'}
      </p>

      <div className="seg" role="group" aria-label="Background type">
        {TYPES.map(function renderType(item) {
          return (
            <button
              key={item.id}
              type="button"
              className={background.type === item.id ? 'active' : ''}
              onClick={function select() {
                onBackgroundChange({ type: item.id })
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {background.type === 'color' ? (
        <div className="color-row">
          <label>
            Color
            <input
              type="color"
              value={background.color}
              onChange={function change(event) {
                onBackgroundChange({ color: event.target.value })
              }}
            />
          </label>
        </div>
      ) : null}

      {background.type === 'gradient' ? (
        <div className="color-row">
          <label>
            From
            <input
              type="color"
              value={background.color}
              onChange={function change(event) {
                onBackgroundChange({ color: event.target.value })
              }}
            />
          </label>
          <label>
            To
            <input
              type="color"
              value={background.color2}
              onChange={function change(event) {
                onBackgroundChange({ color2: event.target.value })
              }}
            />
          </label>
          <select
            value={background.direction}
            aria-label="Gradient direction"
            onChange={function change(event) {
              onBackgroundChange({ direction: event.target.value })
            }}
          >
            {GRADIENT_DIRECTIONS.map(function renderDirection(item) {
              return (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              )
            })}
          </select>
        </div>
      ) : null}

      {background.type === 'image' ? (
        <div>
          <input
            ref={imageInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            hidden
            onChange={onImageChange}
          />
          {backgroundImageName ? (
            <div className="file-chip">
              <span>{backgroundImageName}</span>
              <button
                type="button"
                className="ghost-btn"
                onClick={onClearBackgroundImage}
                aria-label="Remove background image"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="ghost-btn"
            onClick={function open() {
              imageInputRef.current?.click()
            }}
          >
            <ImagePlus size={16} /> {backgroundImageName ? 'Replace image' : 'Choose image'}
          </button>
          <p className="hint">The image stays on this device and is cropped to fill the picture.</p>
        </div>
      ) : null}

      <p className="hint">
        {background.type === 'none'
          ? 'Transparent areas show as a checkerboard. PNG and WebP keep them; JPG fills them with white.'
          : cutout !== 'off'
            ? 'The background is drawn behind the cartoon wherever the original background was removed.'
            : 'A background only shows where the picture is transparent. Choose Smart cutout to remove the original background.'}
      </p>
    </div>
  )
}