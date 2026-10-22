const STORAGE_KEY = 'toonforge-stories-v1'

// Each scene holds a list of dialogue lines. A line has a speaker (a character id, or '' for the
// narrator), the text, an expression for the 3D robot's face, and a pause (seconds) after it.
// 'auto' means: use the face that matches the scene's mood.
export const LINE_EXPRESSIONS = ['auto', 'neutral', 'surprised', 'sad', 'angry']

function newId(prefix) {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// The old single "dialogue" text is kept in sync as all the lines joined together,
// so anything that still reads scene.dialogue keeps working.
export function joinLines(lines) {
  return lines
    .map((line) => line.text.trim())
    .filter(Boolean)
    .join(' ')
}

// Who is on stage in a scene. Any number, and the same character may appear more than once.
// face is that character's default face in the scene: 'auto' follows the scene's mood.
export function createCastMember(overrides = {}) {
  return { id: newId('cast'), characterId: '', face: 'auto', ...overrides }
}

export function normalizeCastMember(value = {}) {
  return {
    id: value.id || newId('cast'),
    characterId: typeof value.characterId === 'string' ? value.characterId : '',
    face: LINE_EXPRESSIONS.includes(value.face) ? value.face : 'auto',
  }
}

export function createLine(overrides = {}) {
  return {
    id: newId('line'),
    characterId: '',
    text: '',
    expression: 'auto',
    pause: 0.5,
    ...overrides,
  }
}

export function normalizeLine(value = {}) {
  const pause = Number(value.pause)
  return {
    id: value.id || newId('line'),
    characterId: typeof value.characterId === 'string' ? value.characterId : '',
    text: typeof value.text === 'string' ? value.text : '',
    expression: LINE_EXPRESSIONS.includes(value.expression) ? value.expression : 'auto',
    pause: Number.isFinite(pause) ? Math.min(10, Math.max(0, pause)) : 0.5,
  }
}

export function createScene(overrides = {}) {
  const characterId = Array.isArray(overrides.characterIds) && overrides.characterIds.length > 0 ? overrides.characterIds[0] : overrides.characterId || ''
  const lines = [createLine({ characterId, text: 'A new idea begins to form.' })]
  const cast = characterId ? [createCastMember({ characterId })] : []

  return {
    id: newId('scene'),
    title: 'Scene 1',
    background: 'sunset',
    backgroundImage: '',
    characterId,
    characterIds: Array.isArray(overrides.characterIds) ? overrides.characterIds : (characterId ? [characterId] : []),
    cast,
    lines,
    dialogue: joinLines(lines),
    mood: 'hopeful',
    notes: '',
    ...overrides,
  }
}

export function createStory(overrides = {}) {
  const nextScene = createScene({ title: 'Scene 1' })
  return {
    id: newId('story'),
    title: 'My Story',
    scenes: [nextScene],
    ...overrides,
  }
}

export function normalizeScene(value = {}) {
  const fallbackIds = Array.isArray(value.characterIds) ? value.characterIds.filter(Boolean) : []
  const fallbackCharacter = typeof value.characterId === 'string' && value.characterId ? value.characterId : fallbackIds[0] || ''

  // Scenes saved before lines existed have one "dialogue" text. It becomes the first line.
  let lines
  if (Array.isArray(value.lines)) {
    lines = value.lines.map(normalizeLine)
  } else if (typeof value.dialogue === 'string' && value.dialogue.trim()) {
    lines = [createLine({ characterId: fallbackCharacter, text: value.dialogue })]
  } else {
    lines = []
  }

  // Scenes saved before the cast existed get one from their old character and the line speakers.
  let cast
  if (Array.isArray(value.cast)) {
    cast = value.cast.map(normalizeCastMember)
  } else {
    const ids = []
    ;[fallbackCharacter, ...fallbackIds, ...lines.map((line) => line.characterId)].forEach(function collect(id) {
      if (id && !ids.includes(id)) ids.push(id)
    })
    cast = ids.map((id) => createCastMember({ characterId: id }))
  }
  const castIds = [...new Set(cast.map((member) => member.characterId).filter(Boolean))]

  return {
    id: value.id || newId('scene'),
    title: value.title || 'Untitled scene',
    background: value.background || 'sunset',
    backgroundImage: typeof value.backgroundImage === 'string' ? value.backgroundImage : '',
    characterId: castIds[0] || '',
    characterIds: castIds,
    cast,
    lines,
    dialogue: joinLines(lines),
    mood: value.mood || 'hopeful',
    notes: value.notes || '',
  }
}

export function normalizeStory(value = {}) {
  const scenes = Array.isArray(value.scenes) && value.scenes.length > 0 ? value.scenes.map(normalizeScene) : [createScene({ title: 'Scene 1' })]

  return {
    id: value.id || newId('story'),
    title: value.title || 'My Story',
    scenes,
  }
}

export function loadStories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return [createStory({ title: 'My first story' })]
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createStory({ title: 'My first story' })]
    }

    return parsed.map(normalizeStory)
  } catch {
    return [createStory({ title: 'My first story' })]
  }
}
// True once something has been saved, so the Dashboard can show an empty state before that.
export function hasSavedStories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return false
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0
  } catch {
    return false
  }
}
export function saveStories(stories) {
  try {
    const payload = Array.isArray(stories) ? stories.map(normalizeStory) : []
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore local storage failures in restricted browser modes
  }
}