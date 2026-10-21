import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, RotateCcw, RotateCw, Trash2, Upload } from 'lucide-react'
import {
  ACCEPTED_TYPES,
  CARTOON_STYLES,
  EXPORT_FORMATS,
  applyCartoon,
  compositeBackground,
  drawFramed,
  getStyleDefaults,
  loadImageFromFile,
  renderExport,
  validateImageFile,
} from '../../lib/image-processing/cartoon.js'
import { MODEL_SIZE, detectSubject, onSegmenterStatus } from '../../lib/ml/segmenter.js'
import { BackgroundControls } from './BackgroundControls.jsx'
import { ExportControls } from './ExportControls.jsx'
import './cartoon-studio.css'

const ACCEPT = ACCEPTED_TYPES.join(',')

export function CartoonStudio() {
  const fileInputRef = useRef(null)
  const compareRef = useRef(null)
  const [compareWidth, setCompareWidth] = useState(0)
  const [dragover, setDragover] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState(null)
  const [style, setStyle] = useState('illustration')
  const [smooth, setSmooth] = useState(2)
  const [edge, setEdge] = useState(72)
  const [levels, setLevels] = useState(6)
  const [saturation, setSaturation] = useState(118)
  const [contrast, setContrast] = useState(108)
  const [rotation, setRotation] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [split, setSplit] = useState(52)
  const [resultUrl, setResultUrl] = useState('')
  const [framedUrl, setFramedUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [cutout, setCutout] = useState('off')
  const [modelStatus, setModelStatus] = useState('idle')
  const [tolerance, setTolerance] = useState(40)
  const [background, setBackground] = useState({
    type: 'none',
    color: '#f4d35e',
    color2: '#ee6c4d',
    direction: 'vertical',
  })
  const [backgroundImage, setBackgroundImage] = useState(null)
  const [exportFormat, setExportFormat] = useState('png')
  const [exportQuality, setExportQuality] = useState(92)
  const [cartoonVersion, setCartoonVersion] = useState(0)
  const cartoonRef = useRef(null)

  useEffect(function cleanupSource() {
    return function revoke() {
      if (source?.objectUrl) {
        URL.revokeObjectURL(source.objectUrl)
      }
    }
  }, [source])

  useEffect(function cleanupResult() {
    return function revoke() {
      if (resultUrl) {
        URL.revokeObjectURL(resultUrl)
      }
    }
  }, [resultUrl])

  useEffect(function cleanupFramed() {
    return function revoke() {
      if (framedUrl) {
        URL.revokeObjectURL(framedUrl)
      }
    }
  }, [framedUrl])

  useEffect(function watchModelStatus() {
    return onSegmenterStatus(setModelStatus)
  }, [])

  useEffect(function renderCartoon() {
    if (!source?.image) {
      return undefined
    }

    let cancelled = false
    setBusy(true)
    const timer = window.setTimeout(async function run() {
      try {
        const frame = drawFramed(source.image, { rotation, zoom })
        let subject = null
        if (cutout === 'smart') {
          try {
            const data = await detectSubject(source.image, rotation)
            subject = { data, size: MODEL_SIZE }
          } catch (problem) {
            if (!cancelled) {
              setError(`Smart cutout is not available: ${problem.message} Switched back to the original background.`)
              setCutout('off')
              setBusy(false)
            }
            return
          }
          if (cancelled) {
            return
          }
        }
        const canvas = applyCartoon(source.image, {
          style,
          smooth,
          edge,
          levels,
          saturation,
          contrast,
          rotation,
          zoom,
          removeBackground: cutout === 'plain',
          backdropTolerance: tolerance,
          subject,
        })
        frame.canvas.toBlob(function framedDone(blob) {
          if (cancelled || !blob) {
            return
          }
          const url = URL.createObjectURL(blob)
          setFramedUrl(function replace(previous) {
            if (previous) {
              URL.revokeObjectURL(previous)
            }
            return url
          })
        }, 'image/png')
        cartoonRef.current = canvas
        setCartoonVersion(function next(version) {
          return version + 1
        })
      } catch (problem) {
        if (!cancelled) {
          setError(problem.message || 'Processing failed.')
          setBusy(false)
        }
      }
    }, 180)

    return function cleanup() {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [source, style, smooth, edge, levels, saturation, contrast, rotation, zoom, cutout, tolerance])

  // Background changes only redraw the cached cartoon, so they stay fast.
  useEffect(function renderComposite() {
    const cartoon = cartoonRef.current
    if (!cartoon) {
      return undefined
    }

    let cancelled = false
    const timer = window.setTimeout(function run() {
      try {
        const composed = compositeBackground(cartoon, {
          ...background,
          image: backgroundImage ? backgroundImage.image : null,
        })
        composed.toBlob(function done(blob) {
          if (cancelled) {
            return
          }
          if (!blob) {
            setError('Could not create the cartoon image.')
            setBusy(false)
            return
          }
          const url = URL.createObjectURL(blob)
          setResultUrl(function replace(previous) {
            if (previous) {
              URL.revokeObjectURL(previous)
            }
            return url
          })
          setBusy(false)
        }, 'image/png')
      } catch (problem) {
        if (!cancelled) {
          setError(problem.message || 'Could not draw the background.')
          setBusy(false)
        }
      }
    }, 60)

    return function cleanup() {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [cartoonVersion, background, backgroundImage])

  useEffect(function watchCompareSize() {
    const node = compareRef.current
    if (!node) {
      return undefined
    }
    function measure() {
      setCompareWidth(node.clientWidth)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return function cleanup() {
      observer.disconnect()
    }
  }, [source])

  const compareStyle = useMemo(
    function makeStyle() {
      return {
        width: `${split}%`,
        '--full-width': compareWidth ? `${compareWidth}px` : '100%',
      }
    },
    [split, compareWidth],
  )

  async function handleFile(file) {
    const message = validateImageFile(file)
    if (message) {
      setError(message)
      return
    }
    setError('')
    try {
      const loaded = await loadImageFromFile(file)
      setSource(function replace(previous) {
        if (previous?.objectUrl) {
          URL.revokeObjectURL(previous.objectUrl)
        }
        return { ...loaded, name: file.name }
      })
      setRotation(0)
      setZoom(1)
    } catch (problem) {
      setError(problem.message)
    }
  }

  function onInputChange(event) {
    const file = event.target.files && event.target.files[0]
    if (file) {
      handleFile(file)
    }
    event.target.value = ''
  }

  function chooseStyle(id) {
    const defaults = getStyleDefaults(id)
    setStyle(id)
    setSmooth(defaults.smooth)
    setEdge(defaults.edge)
    setLevels(defaults.levels)
    setSaturation(defaults.saturation)
    setContrast(defaults.contrast)
  }

  function changeBackground(patch) {
    setBackground(function merge(previous) {
      return { ...previous, ...patch }
    })
  }

  async function handleBackgroundImage(file) {
    const message = validateImageFile(file)
    if (message) {
      setError(message)
      return
    }
    setError('')
    try {
      const loaded = await loadImageFromFile(file)
      // The decoded image stays usable after the temporary URL is released.
      URL.revokeObjectURL(loaded.objectUrl)
      setBackgroundImage({ image: loaded.image, name: file.name })
      changeBackground({ type: 'image' })
    } catch (problem) {
      setError(problem.message)
    }
  }

  function clearImage() {
    cartoonRef.current = null
    setSource(function replace(previous) {
      if (previous?.objectUrl) {
        URL.revokeObjectURL(previous.objectUrl)
      }
      return null
    })
    setResultUrl(function replace(previous) {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return ''
    })
    setFramedUrl(function replace(previous) {
      if (previous) {
        URL.revokeObjectURL(previous)
      }
      return ''
    })
  }

  async function downloadImage() {
    if (!source?.image) {
      return
    }
    setError('')
    try {
      let subject = null
      if (cutout === 'smart') {
        subject = { data: await detectSubject(source.image, rotation), size: MODEL_SIZE }
      }
      const cartoon = applyCartoon(source.image, {
        style,
        smooth,
        edge,
        levels,
        saturation,
        contrast,
        rotation,
        zoom,
        removeBackground: cutout === 'plain',
        backdropTolerance: tolerance,
        subject,
        maxSize: 1920,
      })
      const composed = compositeBackground(cartoon, {
        ...background,
        image: backgroundImage ? backgroundImage.image : null,
      })
      const { blob, extension } = await renderExport(composed, exportFormat, exportQuality / 100)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const base = (source.name || 'cartoon').replace(/\.[^.]+$/, '')
      link.href = url
      link.download = `${base}-toonforge.${extension}`
      link.click()
      window.setTimeout(function release() {
        URL.revokeObjectURL(url)
      }, 1000)
    } catch (problem) {
      setError(problem.message)
    }
  }

  let statusText = 'Updating cartoon…'
  if (modelStatus === 'loading') {
    statusText = 'Loading the cutout model (first use only)…'
  } else if (modelStatus === 'running') {
    statusText = 'Finding the subject…'
  }

  const exportLabel = EXPORT_FORMATS.find(function find(item) {
    return item.id === exportFormat
  })?.label

  return (
    <div>
      <div className="section-head">
        <div>
          <p className="eyebrow">Workspace</p>
          <h3>Cartoon Studio</h3>
          <p>This is an image-processing cartoon filter, not an AI image generator.</p>
        </div>
      </div>

      <div className="studio-layout">
        <section className="panel">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={onInputChange}
          />

          {!source ? (
            <div
              className={dragover ? 'upload-zone dragover' : 'upload-zone'}
              onDragOver={function over(event) {
                event.preventDefault()
                setDragover(true)
              }}
              onDragLeave={function leave() {
                setDragover(false)
              }}
              onDrop={function drop(event) {
                event.preventDefault()
                setDragover(false)
                const file = event.dataTransfer.files && event.dataTransfer.files[0]
                if (file) {
                  handleFile(file)
                }
              }}
            >
              <div>
                <Upload />
                <p>Drop a photo here, or choose a file.</p>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={function open() {
                    fileInputRef.current?.click()
                  }}
                >
                  Upload photo
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="compare" ref={compareRef}>
                <img src={framedUrl || source.objectUrl} alt="Original photograph" />
                {resultUrl ? (
                  <div className="compare-after" style={compareStyle}>
                    <img src={resultUrl} alt="Cartoon result" />
                  </div>
                ) : null}
                <input
                  className="compare-range"
                  type="range"
                  min="4"
                  max="96"
                  value={split}
                  onChange={function slide(event) {
                    setSplit(Number(event.target.value))
                  }}
                  aria-label="Before and after slider"
                />
              </div>
              <div className="preview-actions">
                <button type="button" className="ghost-btn" onClick={function pick() { fileInputRef.current?.click() }}>
                  Replace photo
                </button>
                <button type="button" className="ghost-btn" onClick={function left() { setRotation(rotation - 90) }}>
                  <RotateCcw size={16} /> Rotate
                </button>
                <button type="button" className="ghost-btn" onClick={function right() { setRotation(rotation + 90) }}>
                  <RotateCw size={16} /> Rotate
                </button>
                <button type="button" className="ghost-btn" onClick={clearImage}>
                  <Trash2 size={16} /> Remove
                </button>
                <button type="button" className="primary-btn" onClick={downloadImage} disabled={busy}>
                  <Download size={16} /> Download {exportLabel}
                </button>
              </div>
              <p className="empty-copy">{busy ? statusText : 'Drag the slider to compare original and cartoon.'}</p>
            </>
          )}
          {error ? <div className="error-box">{error}</div> : null}
        </section>

        <aside className="panel">
          <div className="notice">
            Colors are simplified and edges are drawn with our own code. Identity is kept from the photo; we are not inventing a new face.
          </div>
          <h3>Style</h3>
          <div className="style-grid">
            {CARTOON_STYLES.map(function renderStyle(item) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className={style === item.id ? 'style-btn active' : 'style-btn'}
                  onClick={function select() {
                    chooseStyle(item.id)
                  }}
                >
                  <strong>{item.name}</strong>
                  <div className="empty-copy">{item.hint}</div>
                </button>
              )
            })}
          </div>

          <label className="field">
            <span className="field-top">
              Smoothing <span>{smooth}</span>
            </span>
            <input type="range" min="0" max="6" value={smooth} onChange={function change(event) { setSmooth(Number(event.target.value)) }} />
          </label>
          <label className="field">
            <span className="field-top">
              Outline threshold <span>{edge}</span>
            </span>
            <input type="range" min="20" max="180" value={edge} onChange={function change(event) { setEdge(Number(event.target.value)) }} />
          </label>
          <label className="field">
            <span className="field-top">
              Color steps <span>{levels}</span>
            </span>
            <input type="range" min="2" max="12" value={levels} onChange={function change(event) { setLevels(Number(event.target.value)) }} />
          </label>
          <label className="field">
            <span className="field-top">
              Saturation <span>{saturation}%</span>
            </span>
            <input type="range" min="40" max="180" value={saturation} onChange={function change(event) { setSaturation(Number(event.target.value)) }} />
          </label>
          <label className="field">
            <span className="field-top">
              Contrast <span>{contrast}%</span>
            </span>
            <input type="range" min="80" max="140" value={contrast} onChange={function change(event) { setContrast(Number(event.target.value)) }} />
          </label>
          <label className="field">
            <span className="field-top">
              Framing zoom <span>{zoom.toFixed(2)}×</span>
            </span>
            <input type="range" min="1" max="2" step="0.05" value={zoom} onChange={function change(event) { setZoom(Number(event.target.value)) }} />
          </label>

          <BackgroundControls
            cutout={cutout}
            tolerance={tolerance}
            background={background}
            backgroundImageName={backgroundImage ? backgroundImage.name : ''}
            onCutoutChange={setCutout}
            onToleranceChange={setTolerance}
            onBackgroundChange={changeBackground}
            onPickBackgroundImage={handleBackgroundImage}
            onClearBackgroundImage={function clearBackgroundImage() {
              setBackgroundImage(null)
              changeBackground({ type: 'none' })
            }}
          />

          <ExportControls
            format={exportFormat}
            quality={exportQuality}
            mayBeTransparent={background.type === 'none'}
            onFormatChange={setExportFormat}
            onQualityChange={setExportQuality}
          />
        </aside>
      </div>
    </div>
  )
}