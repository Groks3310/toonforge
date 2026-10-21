// Runs the subject-segmentation model off the main thread so the page stays
// responsive. The model (U2-Netp, Apache-2.0) and the onnxruntime-web runtime
// (MIT) both run on this device. Nothing is uploaded.
import wasmUrl from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url'

const MODEL_SIZE = 320
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

let sessionPromise = null

function getSession(modelUrl) {
  if (!sessionPromise) {
    sessionPromise = loadSession(modelUrl).catch(function reset(error) {
      sessionPromise = null
      throw error
    })
  }
  return sessionPromise
}

async function loadSession(modelUrl) {
  postMessage({ type: 'status', status: 'loading' })
  const ort = await import('onnxruntime-web/wasm')

  // Only the .wasm path is overridden; ORT finds its own .mjs next to its bundle.
  ort.env.wasm.wasmPaths = { wasm: new URL(wasmUrl, self.location.origin).href }
  // One thread avoids needing special cross-origin headers on the web server.
  ort.env.wasm.numThreads = 1

  const response = await fetch(modelUrl)
  if (!response.ok) {
    throw new Error('Could not load the cutout model file.')
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] })
  return { ort, session }
}

// RGBA bytes (MODEL_SIZE x MODEL_SIZE) -> normalized CHW float tensor data.
function preprocess(pixels) {
  const count = MODEL_SIZE * MODEL_SIZE
  let max = 1
  for (let p = 0; p < count; p += 1) {
    const i = p * 4
    const top = Math.max(pixels[i], pixels[i + 1], pixels[i + 2])
    if (top > max) {
      max = top
    }
  }
  const input = new Float32Array(3 * count)
  for (let p = 0; p < count; p += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      input[channel * count + p] = (pixels[p * 4 + channel] / max - MEAN[channel]) / STD[channel]
    }
  }
  return input
}

// Stretch the model output to 0..1.
function normalize(values) {
  let low = Infinity
  let high = -Infinity
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] < low) {
      low = values[i]
    }
    if (values[i] > high) {
      high = values[i]
    }
  }
  const range = high - low || 1
  const out = new Float32Array(values.length)
  for (let i = 0; i < values.length; i += 1) {
    out[i] = (values[i] - low) / range
  }
  return out
}

self.onmessage = async function onMessage(event) {
  const { id, pixels, modelUrl } = event.data
  try {
    const { ort, session } = await getSession(modelUrl)
    postMessage({ type: 'status', status: 'running' })
    const tensor = new ort.Tensor('float32', preprocess(pixels), [1, 3, MODEL_SIZE, MODEL_SIZE])
    const outputs = await session.run({ [session.inputNames[0]]: tensor })
    // The first output is the fused prediction.
    const mask = normalize(outputs[session.outputNames[0]].data)
    postMessage({ type: 'result', id, mask }, [mask.buffer])
  } catch (error) {
    console.error('[segmenter worker]', error)
    postMessage({ type: 'error', id, message: error && error.message ? error.message : 'Cutout failed.' })
  }
}