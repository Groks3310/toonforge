// Finds the main subject of a photo with a small model that runs in the browser.
// Use detectSubject() to get the raw model output, then buildSubjectMask()
// (image-processing/mask.js) to turn it into a mask for any output size.
import { drawFramed } from '../image-processing/cartoon.js'

export const MODEL_SIZE = 320
const MODEL_URL = `${import.meta.env.BASE_URL}models/u2netp.onnx`

let worker = null
let nextId = 1
const waiting = new Map()
const listeners = new Set()

// Raw masks are cached per image and rotation, because the model is the slow part.
const cache = new WeakMap()

function emitStatus(status) {
  listeners.forEach(function notify(listener) {
    listener(status)
  })
}

// Subscribe to 'loading' | 'running' | 'idle'. Returns an unsubscribe function.
export function onSegmenterStatus(listener) {
  listeners.add(listener)
  return function unsubscribe() {
    listeners.delete(listener)
  }
}

function failAll(message) {
  waiting.forEach(function fail(entry) {
    entry.reject(new Error(message))
  })
  waiting.clear()
  emitStatus('idle')
}

function getWorker() {
  if (worker) {
    return worker
  }
  worker = new Worker(new URL('./segmenter.worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = function onMessage(event) {
    const data = event.data
    if (data.type === 'status') {
      emitStatus(data.status)
      return
    }
    const entry = waiting.get(data.id)
    if (!entry) {
      return
    }
    waiting.delete(data.id)
    if (waiting.size === 0) {
      emitStatus('idle')
    }
    if (data.type === 'result') {
      entry.resolve(data.mask)
    } else {
      entry.reject(new Error(data.message))
    }
  }
  worker.onerror = function onError() {
    worker = null
    failAll('The cutout model could not start in this browser.')
  }
  return worker
}

function runModel(pixels) {
  return new Promise(function run(resolve, reject) {
    const id = nextId
    nextId += 1
    waiting.set(id, { resolve, reject })
    // Copy to a clean Uint8Array buffer so transfer ownership works cleanly without detaching canvas ImageData backing buffers
    const dataCopy = new Uint8Array(pixels)
    getWorker().postMessage({ id, pixels: dataCopy, modelUrl: MODEL_URL }, [dataCopy.buffer])
  })
}

// Returns Promise<Float32Array(MODEL_SIZE * MODEL_SIZE)>, values 0..1.
export function detectSubject(image, rotation) {
  const turn = ((Math.round(rotation) % 360) + 360) % 360
  let byRotation = cache.get(image)
  if (!byRotation) {
    byRotation = new Map()
    cache.set(image, byRotation)
  }
  if (byRotation.has(turn)) {
    return byRotation.get(turn)
  }

  const frame = drawFramed(image, { rotation: turn, zoom: 1, maxSize: 640 })
  const small = document.createElement('canvas')
  small.width = MODEL_SIZE
  small.height = MODEL_SIZE
  const context = small.getContext('2d', { willReadFrequently: true })
  // Transparent areas become white so the model sees a normal photo.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE)
  context.drawImage(frame.canvas, 0, 0, MODEL_SIZE, MODEL_SIZE)
  const pixels = context.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data

  const promise = runModel(pixels).catch(function forget(error) {
    byRotation.delete(turn)
    throw error
  })
  byRotation.set(turn, promise)
  return promise
}