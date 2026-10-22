// Video export helpers. Everything runs locally in the browser (Canvas + MediaRecorder).
//
// How it works: each frame, the 3D scene is copied onto a second "recording canvas" with a
// background behind it. That canvas is recorded with the browser's MediaRecorder, together
// with the audio if there is any. Nothing is uploaded.

export const VIDEO_PRESETS = {
  landscape: { label: 'Landscape 16:9 (1280 x 720)', width: 1280, height: 720 },
  vertical: { label: 'Vertical 9:16 for Reels, TikTok, Shorts, Status (720 x 1280)', width: 720, height: 1280 },
  square: { label: 'Square 1:1 (720 x 720)', width: 720, height: 720 },
}

export const BACKGROUNDS = {
  blue: { label: 'Blue', top: '#4b63d6', bottom: '#232f78' },
  sunset: { label: 'Sunset', top: '#ff9a6b', bottom: '#b0407a' },
  mint: { label: 'Mint', top: '#6fd6b4', bottom: '#2a6f7a' },
  charcoal: { label: 'Charcoal', top: '#3a3f4d', bottom: '#14161c' },
}

// MP4 plays almost everywhere, so we prefer it. Browsers that cannot record MP4 give WebM.
const FORMATS = [
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' },
]

export function pickVideoFormat() {
  if (typeof MediaRecorder === 'undefined') return null
  return FORMATS.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) || null
}

// A canvas that the 3D view is copied onto, at the exact size of the video.
// framing 'whole' shows the full 3D view. 'close' fills the frame and crops the edges.
export function createCompositor({ width, height, background, framing }) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  let lastDraw = 0

  function draw(source) {
    const now = performance.now()
    if (now - lastDraw < 30) return // about 30 frames per second is enough
    lastDraw = now

    const gradient = context.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, background.top)
    gradient.addColorStop(1, background.bottom)
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)

    if (!source.width || !source.height) return
    const fit = framing === 'close' ? Math.max : Math.min
    const scale = fit(width / source.width, height / source.height)
    const drawWidth = source.width * scale
    const drawHeight = source.height * scale
    context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
  }

  return { canvas, draw }
}

// Starts recording the canvas (and optional audio stream). Call .stop() to finish.
// onDone receives the video Blob and its file extension.
export function startRecording({ canvas, audioStream, onDone }) {
  const format = pickVideoFormat()
  if (!format) {
    throw new Error('This browser cannot record video. Try a recent Chrome, Edge, Firefox or Safari.')
  }

  const stream = canvas.captureStream(30)
  if (audioStream) {
    audioStream.getAudioTracks().forEach((track) => stream.addTrack(track))
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: 4000000,
  })
  const chunks = []

  recorder.ondataavailable = function collect(event) {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data)
    }
  }

  recorder.onstop = function finished() {
    stream.getVideoTracks().forEach((track) => track.stop())
    onDone(new Blob(chunks, { type: format.mimeType.split(';')[0] }), format.extension)
  }

  recorder.start(1000)

  return {
    stop() {
      if (recorder.state !== 'inactive') {
        recorder.stop()
      }
    },
  }
}