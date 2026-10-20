import { EXPORT_FORMATS } from '../../lib/image-processing/cartoon.js'

export function ExportControls({ format, quality, mayBeTransparent, onFormatChange, onQualityChange }) {
  const current = EXPORT_FORMATS.find(function find(item) {
    return item.id === format
  })

  return (
    <div className="control-section">
      <h3>Export</h3>
      <div className="seg seg-3" role="group" aria-label="Export format">
        {EXPORT_FORMATS.map(function renderFormat(item) {
          return (
            <button
              key={item.id}
              type="button"
              className={format === item.id ? 'active' : ''}
              onClick={function select() {
                onFormatChange(item.id)
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      {current?.lossy ? (
        <label className="field">
          <span className="field-top">
            Quality <span>{quality}%</span>
          </span>
          <input
            type="range"
            min="50"
            max="100"
            value={quality}
            onChange={function change(event) {
              onQualityChange(Number(event.target.value))
            }}
          />
        </label>
      ) : null}
      {format === 'jpeg' && mayBeTransparent ? (
        <p className="hint">JPG has no transparency, so empty areas will be white.</p>
      ) : null}
      <p className="hint">Downloads are rendered at up to 1920 px on the longest side.</p>
    </div>
  )
}