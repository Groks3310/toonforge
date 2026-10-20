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
  const pixels = imageData.data
  const luminance = new Float32Array(width * height)

  applyContrastSaturation(pixels, options.contrast / 100, options.saturation / 100)
  buildLuminance(pixels, luminance)

  const smoothRadius = Math.round(options.smooth || 0)
  if (smoothRadius > 0) {
    boxBlur(pixels, width, height, smoothRadius)
  }

  const levels = Math.max(2, Math.round(options.levels || 6))
  posterize(pixels, levels)

  if (style === 'sketch') {
    renderSketch(pixels, luminance, width, height, options.edge)
  } else {
    inkOutlines(pixels, luminance, width, height, options.edge, style)
  }

  context.putImageData(imageData, 0, 0)
  return canvas
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
  const step = 255 / (levels - 1)
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = Math.round(pixels[i] / step) * step
    pixels[i + 1] = Math.round(pixels[i + 1] / step) * step
    pixels[i + 2] = Math.round(pixels[i + 2] / step) * step
  }
}

function boxBlur(pixels, width, height, radius) {
  const source = new Uint8ClampedArray(pixels)
  const temp = new Uint8ClampedArray(pixels.length)
  const diameter = radius * 2 + 1

  for (let y = 0; y < height; y += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      let sum = 0
      for (let kx = -radius; kx <= radius; kx += 1) {
        sum += source[(y * width + wrap(kx, width)) * 4 + channel]
      }
      for (let x = 0; x < width; x += 1) {
        temp[(y * width + x) * 4 + channel] = sum / diameter
        const leaving = source[(y * width + wrap(x - radius, width)) * 4 + channel]
        const entering = source[(y * width + wrap(x + radius + 1, width)) * 4 + channel]
        sum += entering - leaving
      }
    }
  }

  for (let x = 0; x < width; x += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      let sum = 0
      for (let ky = -radius; ky <= radius; ky += 1) {
        sum += temp[(wrap(ky, height) * width + x) * 4 + channel]
      }
      for (let y = 0; y < height; y += 1) {
        const dest = (y * width + x) * 4 + channel
        pixels[dest] = sum / diameter
        const leaving = temp[(wrap(y - radius, height) * width + x) * 4 + channel]
        const entering = temp[(wrap(y + radius + 1, height) * width + x) * 4 + channel]
        sum += entering - leaving
      }
    }
  }
}

function inkOutlines(pixels, luminance, width, height, edgeThreshold, style) {
  const line = style === 'comic' ? 28 : style === 'anime' ? 42 : 34
  const threshold = edgeThreshold || 70
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
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
      const magnitude = Math.abs(gx) + Math.abs(gy)
      if (magnitude > threshold) {
        const i = (y * width + x) * 4
        pixels[i] = line
        pixels[i + 1] = line
        pixels[i + 2] = line
      }
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
