// Mouth animation helpers for Talking Studio. Everything runs locally in the browser.
//
// Two sources of mouth movement:
// 1. watchAudioMouth: measures the loudness of a recording or imported clip while it plays
//    (Web Audio API). This follows the real sound.
// 2. createTextMouth: browser voices do not expose their audio, so we estimate the mouth
//    from the letters of each word as the voice reaches it. It is an approximation.
//
// Both call onLevel(level) with 0 (closed) to 1 (wide open), or null to reset the mouth.

// ---------- 1. Real audio ----------

// An audio element can only be connected to Web Audio once, so we remember it.
const connected = new WeakMap()

function connectAudio(audio) {
  if (connected.has(audio)) return connected.get(audio)
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  const context = new AudioContextClass()
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  const source = context.createMediaElementSource(audio)
  source.connect(analyser)
  analyser.connect(context.destination) // keeps the sound audible
  // A second output that video export records as the soundtrack.
  const recordNode = context.createMediaStreamDestination()
  analyser.connect(recordNode)
  const entry = { context, analyser, recordNode }
  connected.set(audio, entry)
  return entry
}

// The sound of this clip as a stream that MediaRecorder can record (or null if unsupported).
export function getAudioStream(audio) {
  try {
    const entry = connectAudio(audio)
    if (!entry) return null
    entry.context.resume()
    return entry.recordNode.stream
  } catch (error) {
    return null
  }
}

export function watchAudioMouth(audio, onLevel) {
  let entry = null
  try {
    entry = connectAudio(audio)
  } catch (error) {
    entry = null
  }
  if (!entry) return function nothingToStop() {}

  const samples = new Uint8Array(entry.analyser.fftSize)
  let frame = 0
  let level = 0

  function tick() {
    entry.analyser.getByteTimeDomainData(samples)
    let sum = 0
    for (let i = 0; i < samples.length; i += 1) {
      const value = (samples[i] - 128) / 128
      sum += value * value
    }
    const loudness = Math.sqrt(sum / samples.length)
    const target = Math.min(1, Math.max(0, (loudness - 0.015) * 7))
    // Open quickly, close a little slower, so the mouth does not flicker.
    level += (target - level) * (target > level ? 0.6 : 0.25)
    onLevel(level)
    frame = requestAnimationFrame(tick)
  }

  function start() {
    entry.context.resume()
    cancelAnimationFrame(frame)
    tick()
  }

  function stop() {
    cancelAnimationFrame(frame)
    level = 0
    onLevel(null)
  }

  audio.addEventListener('play', start)
  audio.addEventListener('pause', stop)
  audio.addEventListener('ended', stop)
  if (!audio.paused) start()

  return function cleanup() {
    audio.removeEventListener('play', start)
    audio.removeEventListener('pause', stop)
    audio.removeEventListener('ended', stop)
    stop()
  }
}

// ---------- 2. Text-timed mouth for browser voices ----------

const VOWEL_OPENING = { a: 1, o: 0.8, e: 0.65, u: 0.55, i: 0.45, y: 0.4 }

// Turns text into a list of mouth openings: open vowels, closed b/m/p, small for other letters.
function shapesFor(text) {
  const shapes = []
  for (const letter of text.toLowerCase()) {
    if (VOWEL_OPENING[letter] !== undefined) {
      shapes.push(VOWEL_OPENING[letter])
    } else if ('bmp'.includes(letter)) {
      shapes.push(0)
    } else if (/[a-z]/.test(letter)) {
      shapes.push(0.25)
    } else if (/[,.!?;:]/.test(letter)) {
      shapes.push(0, 0)
    }
  }
  return shapes
}

export function createTextMouth(onLevel) {
  let shapes = []
  let start = 0
  let end = 0
  let level = 0
  let frame = 0

  function tick() {
    const now = performance.now()
    let target = 0
    if (now < end && shapes.length > 0) {
      const progress = (now - start) / (end - start)
      target = shapes[Math.min(shapes.length - 1, Math.floor(progress * shapes.length))]
    }
    level += (target - level) * 0.35
    onLevel(level)
    frame = requestAnimationFrame(tick)
  }

  return {
    // Animate the mouth across this text. rate is the voice speed (1 = normal).
    word(text, rate) {
      shapes = shapesFor(text)
      start = performance.now()
      end = start + Math.max(120, (text.length * 70) / (rate || 1))
      if (!frame) frame = requestAnimationFrame(tick)
    },
    stop() {
      cancelAnimationFrame(frame)
      frame = 0
      shapes = []
      level = 0
      onLevel(null)
    },
  }
}