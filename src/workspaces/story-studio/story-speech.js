export const SPEECH_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window

export function wait(ms) {
  return new Promise(function run(resolve) {
    setTimeout(resolve, ms)
  })
}

// Used when the browser cannot speak: estimate how long the text takes to read.
export function readingTime(text) {
  return Math.max(1500, text.split(/\s+/).length * 400)
}

// Gives each speaker a slightly different pitch, so two characters do not sound identical.
export function pitchFor(characterId) {
  let sum = 0
  for (const letter of characterId || '') {
    sum += letter.charCodeAt(0)
  }
  return 0.85 + (sum % 5) * 0.1
}

// Resolves true when the line finished, false if speech failed or was cancelled.
// handlers (optional) lets the 3D robot's mouth follow the words:
//   onWord(word) is called as the voice reaches each word,
//   onFallback(text) is called if the voice never reports word timing.
export function speakLine(text, handlers, pitch) {
  return new Promise(function run(resolve) {
    if (!SPEECH_SUPPORTED) {
      resolve(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.pitch = pitch || 1
    let sawBoundary = false
    let fallbackTimer = 0

    utterance.onstart = function start() {
      if (handlers) {
        fallbackTimer = setTimeout(function fallback() {
          if (!sawBoundary) handlers.onFallback(text)
        }, 400)
      }
    }
    utterance.onboundary = function boundary(event) {
      if (event.name && event.name !== 'word') return
      sawBoundary = true
      const match = text.slice(event.charIndex).match(/^\S+/)
      if (match && handlers) handlers.onWord(match[0])
    }
    utterance.onend = function end() {
      clearTimeout(fallbackTimer)
      resolve(true)
    }
    utterance.onerror = function fail() {
      clearTimeout(fallbackTimer)
      resolve(false)
    }
    window.speechSynthesis.speak(utterance)
  })
}