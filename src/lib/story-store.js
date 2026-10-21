const STORAGE_KEY = 'toonforge-stories-v1'

export function createScene(overrides = {}) {
  const characterId = Array.isArray(overrides.characterIds) && overrides.characterIds.length > 0 ? overrides.characterIds[0] : overrides.characterId || ''

  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `scene-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: 'Scene 1',
    background: 'sunset',
    backgroundImage: '',
    characterId,
    characterIds: Array.isArray(overrides.characterIds) ? overrides.characterIds : (characterId ? [characterId] : []),
    dialogue: 'A new idea begins to form.',
    mood: 'hopeful',
    notes: '',
    ...overrides,
  }
}

export function createStory(overrides = {}) {
  const nextScene = createScene({ title: 'Scene 1' })
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `story-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: 'My Story',
    scenes: [nextScene],
    ...overrides,
  }
}

export function normalizeScene(value = {}) {
  const fallbackIds = Array.isArray(value.characterIds) ? value.characterIds.filter(Boolean) : []
  const fallbackCharacter = typeof value.characterId === 'string' && value.characterId ? value.characterId : fallbackIds[0] || ''

  return {
    id: value.id || createScene().id,
    title: value.title || 'Untitled scene',
    background: value.background || 'sunset',
    backgroundImage: typeof value.backgroundImage === 'string' ? value.backgroundImage : '',
    characterId: fallbackCharacter,
    characterIds: fallbackIds.length > 0 ? fallbackIds : (fallbackCharacter ? [fallbackCharacter] : []),
    dialogue: value.dialogue || '',
    mood: value.mood || 'hopeful',
    notes: value.notes || '',
  }
}

export function normalizeStory(value = {}) {
  const scenes = Array.isArray(value.scenes) && value.scenes.length > 0 ? value.scenes.map(normalizeScene) : [createScene({ title: 'Scene 1' })]

  return {
    id: value.id || createStory().id,
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

export function saveStories(stories) {
  try {
    const payload = Array.isArray(stories) ? stories.map(normalizeStory) : []
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore local storage failures in restricted browser modes
  }
}
