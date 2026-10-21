import { buildSubjectMask } from './mask.js'

export const MAX_FILE_BYTES = 20 * 1024 * 1024

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const CARTOON_STYLES = [
  {
    id: 'illustration',
    name: 'Cartoon illustration',
    hint: 'Smoothed color blocks with ink outlines',
  },
  {
    id: 'comic',
    name: 'Comic-book',
    hint: 'Stronger ink lines and punchier contrast',
  },
  {
    id: 'sketch',
    name: 'Sketch',
    hint: 'Pencil-style edges on a paper ground',
  },
  {
    id: 'anime',
    name: 'Anime-inspired',
    hint: 'Brighter color, thinner outlines',
  },
  {
    id: 'popart',
    name: 'Pop-art',
    hint: 'Hard posterized color, high saturation',
  },
  {
    id: 'flat',
    name: 'Flat-color',
    hint: 'Few color steps, almost no shading',
  },
  {
    id: 'poster',
    name: 'Posterized portrait',
    hint: 'Limited palette with a print look',
  },
  {
    id: 'soft3d',
    name: 'Soft cartoon',
    hint: 'Gentler smoothing, lighter outlines',
  },
]

const STYLE_DEFAULTS = {
  illustration: { smooth: 2, edge: 72, levels: 6, saturation: 118, contrast: 108 },
  comic: { smooth: 1, edge: 48, levels: 5, saturation: 122, contrast: 118 },
  sketch: { smooth: 1, edge: 40, levels: 8, saturation: 40, contrast: 110 },
  anime: { smooth: 3, edge: 88, levels: 7, saturation: 130, contrast: 106 },
  popart: { smooth: 0, edge: 70, levels: 3, saturation: 160, contrast: 124 },
  flat: { smooth: 3, edge: 140, levels: 4, saturation: 112, contrast: 104 },
  poster: { smooth: 2, edge: 96, levels: 4, saturation: 120, contrast: 112 },
  soft3d: { smooth: 4, edge: 110, levels: 8, saturation: 110, contrast: 102 },
}

export function getStyleDefaults(styleId) {
  return { ...(STYLE_DEFAULTS[styleId] || STYLE_DEFAULTS.illustration) }
}

export function validateImageFile(file) {
  if (!file) {
    return 'Choose an image file.'
  }
  const nameLooksValid = /\.(jpe?g|png|webp|gif)$/i.test(file.name)
  if (file.type && !ACCEPTED_TYPES.includes(file.type) && !nameLooksValid) {
    return 'Use a JPEG, PNG, WebP, or GIF file.'
  }
  if (!file.type && !nameLooksValid) {
    return 'Use a JPEG, PNG, WebP, or GIF file.'
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'That file is larger than 20 MB.'
  }
  return null
}

export function loadImageFromFile(file) {
  const objectUrl = URL.createObjectURL(file)
  return new Promise(function load(resolve, reject) {
    const image = new Image()
    image.onload = function onLoad() {
      resolve({ image, objectUrl })
    }
    image.onerror = function onError() {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('This file could not be opened as an image.'))
    }
    image.src = objectUrl
  })
}

export function drawFramed(image, options) {
  const rotation = ((options.rotation % 360) + 360) % 360
  const zoom = Math.max(1, Math.min(2.4, options.zoom || 1))
  const maxSize = options.maxSize || 1400

  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  const swapped = rotation === 90 || rotation === 270
  const rotatedWidth = swapped ? sourceHeight : sourceWidth
  const rotatedHeight = swapped ? sourceWidth : sourceHeight

  const scale = Math.min(1, maxSize / Math.max(rotatedWidth, rotatedHeight))
  const width = Math.max(1, Math.round(rotatedWidth * scale))
  const height = Math.max(1, Math.round(rotatedHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('Canvas is not available in this browser.')
  }

  context.save()
  context.translate(width / 2, height / 2)
  context.rotate((rotation * Math.PI) / 180)
  const drawWidth = swapped ? height : width
  const drawHeight = swapped ? width : height
  context.scale(zoom, zoom)
  context.drawImage(
    image,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  )
  context.restore()
  return { canvas, context, width, height }
}

export function applyCartoon(image, options) {
  const style = options.style || 'illustration'
  const framed = drawFramed(image, options)
  const { canvas, context, width, height } = framed

  const imageData = context.getImageData(0, 0, width, height)
  cartoonPixels(imageData.data, width, height, { ...options, style })
  context.putImageData(imageData, 0, 0)
  return canvas
}

// The whole cartoon pipeline on raw RGBA pixels. It has no canvas or DOM
// dependency, so it can be tested outside the browser.
export function cartoonPixels(pixels, width, height, options) {
  const style = options.style || 'illustration'
  const contrast = (options.contrast ?? 100) / 100
  const saturation = (options.saturation ?? 100) / 100
  const smoothPasses = Math.round(options.smooth || 0)
  const levels = Math.max(2, Math.round(options.levels || 6))

  // Make a plain backdrop transparent first, so smoothing and outlines treat it
  // as empty space instead of part of the subject.
  let backdrop = null
  let subject = null
  if (options.subject) {
    // options.subject = { data, size } is the raw segmentation model output.
    const mask = buildSubjectMask(options.subject.data, options.subject.size, width, height, options.zoom || 1)
    subject = isolateSubject(pixels, width, height, mask)
  } else if (options.removeBackground) {
    backdrop = removePlainBackdrop(pixels, width, height, options.backdropTolerance ?? 40)
  }

  applyContrastSaturation(pixels, contrast, saturation)

  // Edge-preserving smoothing keeps outlines sharp while flattening textures.
  if (smoothPasses > 0) {
    bilateralSmooth(pixels, width, height, smoothPasses)
  }

  // Outlines come from the smoothed image, so noise does not become ink lines.
  const luminance = new Float32Array(width * height)
  buildLuminance(pixels, luminance)

  posterize(pixels, levels)

  if (smoothPasses > 0) {
    cleanSpecks(pixels, width, height, smoothPasses >= 3 ? 2 : 1)
  }

  if (style === 'sketch') {
    renderSketch(pixels, luminance, width, height, options.edge)
  } else {
    inkOutlines(pixels, luminance, width, height, options.edge, style)
  }

  // The thin rim kept for outlines is dropped wherever no ink landed on it,
  // which removes the pale halo around the subject.
  if (backdrop) {
    dropUninkedRim(pixels, backdrop)
  }
  if (subject) {
    applySubjectAlpha(pixels, subject)
  }
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise(function toBlob(resolve, reject) {
    canvas.toBlob(
      function done(blob) {
        if (!blob) {
          reject(new Error('Could not encode the image.'))
          return
        }
        resolve(blob)
      },
      type,
      quality,
    )
  })
}

export const EXPORT_FORMATS = [
  { id: 'png', label: 'PNG', mime: 'image/png', extension: 'png', lossy: false, transparent: true },
  { id: 'jpeg', label: 'JPG', mime: 'image/jpeg', extension: 'jpg', lossy: true, transparent: false },
  { id: 'webp', label: 'WebP', mime: 'image/webp', extension: 'webp', lossy: true, transparent: true },
]

export const GRADIENT_DIRECTIONS = [
  { id: 'vertical', label: 'Top to bottom' },
  { id: 'horizontal', label: 'Left to right' },
  { id: 'diagonal', label: 'Diagonal' },
]

// Draws the chosen background behind a (possibly transparent) cartoon canvas.
// background: { type: 'none' | 'color' | 'gradient' | 'image', color, color2, direction, image }
// With type 'none' the cartoon canvas is returned unchanged.
export function compositeBackground(cartoonCanvas, background) {
  const type = background?.type || 'none'
  if (type === 'none') {
    return cartoonCanvas
  }
  if (type === 'image' && !background.image) {
    return cartoonCanvas
  }

  const width = cartoonCanvas.width
  const height = cartoonCanvas.height
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas is not available in this browser.')
  }

  if (type === 'color') {
    context.fillStyle = background.color || '#ffffff'
    context.fillRect(0, 0, width, height)
  } else if (type === 'gradient') {
    let gradient
    if (background.direction === 'horizontal') {
      gradient = context.createLinearGradient(0, 0, width, 0)
    } else if (background.direction === 'diagonal') {
      gradient = context.createLinearGradient(0, 0, width, height)
    } else {
      gradient = context.createLinearGradient(0, 0, 0, height)
    }
    gradient.addColorStop(0, background.color || '#ffffff')
    gradient.addColorStop(1, background.color2 || '#000000')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
  } else if (type === 'image') {
    const imageWidth = background.image.naturalWidth || background.image.width
    const imageHeight = background.image.naturalHeight || background.image.height
    const scale = Math.max(width / imageWidth, height / imageHeight)
    const drawWidth = imageWidth * scale
    const drawHeight = imageHeight * scale
    context.drawImage(
      background.image,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    )
  }

  context.drawImage(cartoonCanvas, 0, 0)
  return canvas
}

// Encodes a canvas in one of EXPORT_FORMATS. Formats without transparency
// (JPG) are flattened onto white first. Throws if the browser cannot encode it.
export async function renderExport(canvas, formatId, quality) {
  const format = EXPORT_FORMATS.find(function find(item) {
    return item.id === formatId
  })
  if (!format) {
    throw new Error('Unknown export format.')
  }

  let source = canvas
  if (!format.transparent) {
    source = document.createElement('canvas')
    source.width = canvas.width
    source.height = canvas.height
    const context = source.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, source.width, source.height)
    context.drawImage(canvas, 0, 0)
  }

  const blob = await canvasToBlob(source, format.mime, format.lossy ? quality : undefined)
  if (blob.type !== format.mime) {
    throw new Error(`This browser cannot export ${format.label}. Try PNG or JPG.`)
  }
  return { blob, extension: format.extension }
}

// Smart cutout, step 1. Everything outside the subject mask is flattened to one
// plain color, so smoothing and outlines see a clean subject-versus-flat edge
// instead of a busy background. Returns what step 2 needs, or null when the
// model found nothing (or found the whole picture).
function isolateSubject(pixels, width, height, mask) {
  let sum = 0
  let count = 0
  for (let p = 0; p < mask.length; p += 1) {
    if (mask[p] >= 128) {
      const i = p * 4
      sum += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
      count += 1
    }
  }
  if (count === 0 || count === mask.length) {
    return null
  }

  // A flat color that contrasts with the subject, so an outline can form.
  const flat = sum / count > 140 ? 38 : 235
  for (let p = 0; p < mask.length; p += 1) {
    if (mask[p] < 128) {
      const i = p * 4
      pixels[i] = flat
      pixels[i + 1] = flat
      pixels[i + 2] = flat
      pixels[i + 3] = 255
    }
  }

  // Final opacity: the mask grown a little (so the outer half of an outline
  // survives) and feathered by one pixel.
  const alpha = new Uint8Array(mask)
  const grow = Math.max(1, Math.round(Math.max(width, height) / 700))
  dilateMask(alpha, width, height, grow)
  featherMask(alpha, width, height)
  return { mask, alpha, flat }
}

// Smart cutout, step 2, after the cartoon effect has been drawn. Pixels just
// outside the subject that no outline touched are dropped, so no flat-colored
// halo is left around the subject.
function applySubjectAlpha(pixels, subject) {
  const { mask, alpha, flat } = subject
  for (let p = 0; p < mask.length; p += 1) {
    const i = p * 4
    let opacity = alpha[p]
    if (mask[p] < 128 && opacity > 0) {
      const luminance = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
      if (Math.abs(luminance - flat) < 40) {
        opacity = 0
      }
    }
    if (opacity < pixels[i + 3]) {
      pixels[i + 3] = opacity
    }
  }
}

// One pass of a 3x3 average: softens the staircase edge of a mask.
function featherMask(mask, width, height) {
  const copy = new Uint8Array(mask)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let sum = 0
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          sum += copy[(y + ky) * width + (x + kx)]
        }
      }
      mask[y * width + x] = sum / 9
    }
  }
}

// Makes the plain backdrop transparent: starting from the image border, it
// spreads through pixels whose color is close to the average border color.
// This is a simple color rule, not AI: it works on solid, light backdrops and
// will not separate a subject from a busy or similarly colored background.
function removePlainBackdrop(pixels, width, height, tolerance) {
  let sumR = 0
  let sumG = 0
  let sumB = 0
  let count = 0
  function sample(x, y) {
    const i = (y * width + x) * 4
    if (pixels[i + 3] > 0) {
      sumR += pixels[i]
      sumG += pixels[i + 1]
      sumB += pixels[i + 2]
      count += 1
    }
  }
  for (let x = 0; x < width; x += 1) {
    sample(x, 0)
    sample(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    sample(0, y)
    sample(width - 1, y)
  }
  if (count === 0) {
    return null
  }
  const refR = sumR / count
  const refG = sumG / count
  const refB = sumB / count
  const limit = tolerance * tolerance

  function isBackdrop(p) {
    const i = p * 4
    if (pixels[i + 3] === 0) {
      return true
    }
    const dr = pixels[i] - refR
    const dg = pixels[i + 1] - refG
    const db = pixels[i + 2] - refB
    return dr * dr + dg * dg + db * db <= limit
  }

  const removed = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0
  function seed(p) {
    if (!removed[p] && isBackdrop(p)) {
      removed[p] = 1
      queue[tail] = p
      tail += 1
    }
  }
  for (let x = 0; x < width; x += 1) {
    seed(x)
    seed((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    seed(y * width)
    seed(y * width + width - 1)
  }
  while (head < tail) {
    const p = queue[head]
    head += 1
    const x = p % width
    if (x > 0) {
      seed(p - 1)
    }
    if (x < width - 1) {
      seed(p + 1)
    }
    if (p >= width) {
      seed(p - width)
    }
    if (p < width * (height - 1)) {
      seed(p + width)
    }
  }

  // Keep a thin rim of backdrop next to the subject so ink outlines are drawn
  // on visible pixels instead of being half cut away.
  const rim = Math.max(1, Math.round(Math.max(width, height) / 700))
  const rimMask = new Uint8Array(width * height)
  for (let pass = 0; pass < rim; pass += 1) {
    const edge = []
    for (let p = 0; p < removed.length; p += 1) {
      if (!removed[p]) {
        continue
      }
      const x = p % width
      const y = (p - x) / width
      if (
        (x > 0 && !removed[p - 1]) ||
        (x < width - 1 && !removed[p + 1]) ||
        (y > 0 && !removed[p - width]) ||
        (y < height - 1 && !removed[p + width])
      ) {
        edge.push(p)
      }
    }
    for (let k = 0; k < edge.length; k += 1) {
      removed[edge[k]] = 0
      rimMask[edge[k]] = 1
    }
  }

  for (let p = 0; p < removed.length; p += 1) {
    if (removed[p]) {
      pixels[p * 4 + 3] = 0
    }
  }
  return { rimMask, refLuminance: 0.2126 * refR + 0.7152 * refG + 0.0722 * refB }
}

// A rim pixel whose brightness is still close to the backdrop was not touched
// by an outline, so it becomes transparent too.
function dropUninkedRim(pixels, backdrop) {
  const { rimMask, refLuminance } = backdrop
  for (let p = 0; p < rimMask.length; p += 1) {
    if (!rimMask[p]) {
      continue
    }
    const i = p * 4
    const luminance = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
    if (Math.abs(luminance - refLuminance) < 40) {
      pixels[i + 3] = 0
    }
  }
}

function applyContrastSaturation(pixels, contrast, saturation) {
  for (let i = 0; i < pixels.length; i += 4) {
    let r = pixels[i]
    let g = pixels[i + 1]
    let b = pixels[i + 2]

    r = (r - 128) * contrast + 128
    g = (g - 128) * contrast + 128
    b = (b - 128) * contrast + 128

    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b
    r = gray + (r - gray) * saturation
    g = gray + (g - gray) * saturation
    b = gray + (b - gray) * saturation

    pixels[i] = clamp(r)
    pixels[i + 1] = clamp(g)
    pixels[i + 2] = clamp(b)
  }
}

function buildLuminance(pixels, luminance) {
  let index = 0
  for (let i = 0; i < pixels.length; i += 4) {
    luminance[index] = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
    index += 1
  }
}

function posterize(pixels, levels) {
  // Quantize brightness into bands and keep each pixel's hue, so shading looks
  // like cel-shading instead of random per-channel color patches.
  const step = 255 / (levels - 1)
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const yq = Math.round(y / step) * step
    if (y < 1) {
      pixels[i] = yq
      pixels[i + 1] = yq
      pixels[i + 2] = yq
      continue
    }
    const k = yq / y
    pixels[i] = clamp(r * k)
    pixels[i + 1] = clamp(g * k)
    pixels[i + 2] = clamp(b * k)
  }
}

// Bilateral filter: averages nearby pixels, but pixels with a very different
// color get little weight, so edges survive. Transparent pixels are ignored.
function bilateralSmooth(pixels, width, height, passes) {
  const radius = 2
  const size = radius * 2 + 1
  const spatial = new Float32Array(size * size)
  for (let ky = -radius; ky <= radius; ky += 1) {
    for (let kx = -radius; kx <= radius; kx += 1) {
      spatial[(ky + radius) * size + (kx + radius)] = Math.exp(-(kx * kx + ky * ky) / (2 * 1.6 * 1.6))
    }
  }
  const sigma = 36
  const range = new Float32Array(766)
  for (let d = 0; d < range.length; d += 1) {
    range[d] = Math.exp(-(d * d) / (2 * sigma * sigma))
  }

  let src = new Uint8ClampedArray(pixels)
  let dst = new Uint8ClampedArray(pixels.length)

  for (let pass = 0; pass < passes; pass += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const alpha = src[i + 3]
        dst[i + 3] = alpha
        if (alpha === 0) {
          dst[i] = src[i]
          dst[i + 1] = src[i + 1]
          dst[i + 2] = src[i + 2]
          continue
        }
        const r0 = src[i]
        const g0 = src[i + 1]
        const b0 = src[i + 2]
        let sumR = 0
        let sumG = 0
        let sumB = 0
        let sumW = 0
        for (let ky = -radius; ky <= radius; ky += 1) {
          const yy = y + ky
          if (yy < 0 || yy >= height) {
            continue
          }
          for (let kx = -radius; kx <= radius; kx += 1) {
            const xx = x + kx
            if (xx < 0 || xx >= width) {
              continue
            }
            const j = (yy * width + xx) * 4
            const alphaJ = src[j + 3]
            if (alphaJ === 0) {
              continue
            }
            const r = src[j]
            const g = src[j + 1]
            const b = src[j + 2]
            const diff = Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0)
            const weight = spatial[(ky + radius) * size + (kx + radius)] * range[diff] * (alphaJ / 255)
            sumR += r * weight
            sumG += g * weight
            sumB += b * weight
            sumW += weight
          }
        }
        dst[i] = sumR / sumW
        dst[i + 1] = sumG / sumW
        dst[i + 2] = sumB / sumW
      }
    }
    const swap = src
    src = dst
    dst = swap
  }

  pixels.set(src)
}

// After posterizing, single stray pixels and thin specks of a different color
// are replaced by the most common color in their 3x3 neighborhood.
function cleanSpecks(pixels, width, height, passes) {
  const keys = new Int32Array(width * height)
  const neighbors = new Int32Array(9)
  for (let pass = 0; pass < passes; pass += 1) {
    for (let p = 0, i = 0; p < keys.length; p += 1, i += 4) {
      keys[p] = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]
    }
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const p = y * width + x
        let n = 0
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            neighbors[n] = keys[p + ky * width + kx]
            n += 1
          }
        }
        const center = keys[p]
        let best = center
        let bestCount = 0
        for (let a = 0; a < 9; a += 1) {
          if (neighbors[a] === center) {
            bestCount += 1
          }
        }
        for (let a = 0; a < 9; a += 1) {
          let count = 0
          for (let b = 0; b < 9; b += 1) {
            if (neighbors[b] === neighbors[a]) {
              count += 1
            }
          }
          if (count > bestCount) {
            best = neighbors[a]
            bestCount = count
          }
        }
        if (best !== center) {
          const i = p * 4
          pixels[i] = (best >> 16) & 255
          pixels[i + 1] = (best >> 8) & 255
          pixels[i + 2] = best & 255
        }
      }
    }
  }
}

function sobelMagnitude(luminance, width, x, y) {
  const gx =
    -luminance[(y - 1) * width + (x - 1)] +
    luminance[(y - 1) * width + (x + 1)] +
    -2 * luminance[y * width + (x - 1)] +
    2 * luminance[y * width + (x + 1)] +
    -luminance[(y + 1) * width + (x - 1)] +
    luminance[(y + 1) * width + (x + 1)]
  const gy =
    -luminance[(y - 1) * width + (x - 1)] +
    -2 * luminance[(y - 1) * width + x] +
    -luminance[(y - 1) * width + (x + 1)] +
    luminance[(y + 1) * width + (x - 1)] +
    2 * luminance[(y + 1) * width + x] +
    luminance[(y + 1) * width + (x + 1)]
  return Math.abs(gx) + Math.abs(gy)
}

// Grow a 0-255 mask by `radius` pixels (separable maximum filter).
function dilateMask(mask, width, height, radius) {
  const temp = new Uint8Array(mask.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let best = 0
      for (let k = -radius; k <= radius; k += 1) {
        const v = mask[y * width + wrap(x + k, width)]
        if (v > best) {
          best = v
        }
      }
      temp[y * width + x] = best
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let best = 0
      for (let k = -radius; k <= radius; k += 1) {
        const v = temp[wrap(y + k, height) * width + x]
        if (v > best) {
          best = v
        }
      }
      mask[y * width + x] = best
    }
  }
}

// Soften staircase edges: keep the line, add a faint blurred halo around it.
function softenMask(mask, width, height) {
  const blurred = new Uint8Array(mask.length)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let sum = 0
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          sum += mask[(y + ky) * width + (x + kx)]
        }
      }
      blurred[y * width + x] = sum / 9
    }
  }
  for (let p = 0; p < mask.length; p += 1) {
    const boosted = Math.min(255, blurred[p] * 1.8)
    if (boosted > mask[p]) {
      mask[p] = boosted
    }
  }
}

function inkOutlines(pixels, luminance, width, height, edgeThreshold, style) {
  const line = style === 'comic' ? 28 : style === 'anime' ? 42 : 34
  const threshold = edgeThreshold || 70
  const ramp = threshold * 0.7 + 1
  const mask = new Uint8Array(width * height)

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const strength = (sobelMagnitude(luminance, width, x, y) - threshold) / ramp
      if (strength > 0) {
        mask[y * width + x] = strength >= 1 ? 255 : strength * 255
      }
    }
  }

  // Line weight scales with image size so preview and download look alike.
  const scale = Math.max(1, Math.round(Math.max(width, height) / 1200))
  const grow = (style === 'comic' ? 1 : 0) * scale
  if (grow > 0) {
    dilateMask(mask, width, height, grow)
  }
  softenMask(mask, width, height)

  for (let p = 0; p < mask.length; p += 1) {
    const amount = mask[p] / 255
    if (amount > 0) {
      const i = p * 4
      pixels[i] = pixels[i] + (line - pixels[i]) * amount
      pixels[i + 1] = pixels[i + 1] + (line - pixels[i + 1]) * amount
      pixels[i + 2] = pixels[i + 2] + (line - pixels[i + 2]) * amount
    }
  }
}

function renderSketch(pixels, luminance, width, height, edgeThreshold) {
  const threshold = edgeThreshold || 40
  const paper = 245
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      let ink = paper
      if (x > 0 && y > 0 && x < width - 1 && y < height - 1) {
        const gx =
          -luminance[(y - 1) * width + (x - 1)] +
          luminance[(y - 1) * width + (x + 1)] +
          -2 * luminance[y * width + (x - 1)] +
          2 * luminance[y * width + (x + 1)]
        const gy =
          -2 * luminance[(y - 1) * width + x] +
          2 * luminance[(y + 1) * width + x]
        const magnitude = Math.abs(gx) + Math.abs(gy)
        if (magnitude > threshold) {
          ink = Math.max(20, 230 - magnitude)
        } else {
          const shade = luminance[y * width + x]
          ink = paper - (255 - shade) * 0.08
        }
      }
      pixels[i] = ink
      pixels[i + 1] = ink - 2
      pixels[i + 2] = ink - 8
    }
  }
}

function wrap(value, max) {
  if (value < 0) {
    return 0
  }
  if (value >= max) {
    return max - 1
  }
  return value
}

function clamp(value) {
  if (value < 0) {
    return 0
  }
  if (value > 255) {
    return 255
  }
  return value
}