import { MOTION_OPTIONS } from './motion-library.js'

const STORAGE_KEY = 'toonforge-motion-sequences-v1'
const MIN_SECONDS = 0.5
const MAX_SECONDS = 60

function makeId(prefix) {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createStep(overrides = {}) {
  return { id: makeId('step'), motionId: 'idle', seconds: 3, ...overrides }
}

export function createSequence(overrides = {}) {
  return { id: makeId('seq'), name: 'My sequence', steps: [], ...overrides }
}

export function normalizeStep(value) {
  const source = value && typeof value === 'object' ? value : {}
  const known = MOTION_OPTIONS.some((option) => option.id === source.motionId)
  const seconds = Number(source.seconds)
  return {
    id: source.id || makeId('step'),
    motionId: known ? source.motionId : 'idle',
    seconds: Number.isFinite(seconds) ? Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, seconds)) : 3,
  }
}

export function normalizeSequence(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    id: source.id || makeId('seq'),
    name: typeof source.name === 'string' && source.name.trim() ? source.name : 'My sequence',
    steps: Array.isArray(source.steps) ? source.steps.map(normalizeStep) : [],
  }
}

function starterSequence() {
  return createSequence({
    name: 'Example: walk, wave, sit',
    steps: [
      createStep({ motionId: 'walk' }),
      createStep({ motionId: 'wave' }),
      createStep({ motionId: 'sit' }),
    ],
  })
}

export function loadSequences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return [starterSequence()]
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [starterSequence()]
    }
    return parsed.map(normalizeSequence)
  } catch {
    return [starterSequence()]
  }
}

export function saveSequences(sequences) {
  try {
    const payload = Array.isArray(sequences) ? sequences.map(normalizeSequence) : []
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}