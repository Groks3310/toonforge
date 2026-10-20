import { useMemo } from 'react'

const STORAGE_KEY = 'toonforge-characters-v1'

export const DEFAULT_COLOR_SET = {
  skin: '#f3c79b',
  hair: '#2d1f1a',
  eyes: '#2a6f9d',
  outfit: '#5f7cff',
  accent: '#f3d36d',
}

export function createCharacter(overrides = {}) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `char-${Date.now()}-${Math.random().toString(16).slice(2)}`
  return {
    id,
    name: 'Nova',
    body: 'classic',
    expression: 'neutral',
    favorite: false,
    skinTone: DEFAULT_COLOR_SET.skin,
    hairColor: DEFAULT_COLOR_SET.hair,
    eyeColor: DEFAULT_COLOR_SET.eyes,
    outfitColor: DEFAULT_COLOR_SET.outfit,
    accentColor: DEFAULT_COLOR_SET.accent,
    outfitStyle: 'hero',
    accessory: 'none',
    ...overrides,
  }
}

export function normalizeCharacter(value) {
  if (!value || typeof value !== 'object') {
    return createCharacter()
  }

  return {
    id: value.id || createCharacter().id,
    name: value.name || 'Unnamed character',
    body: value.body || 'classic',
    expression: value.expression || 'neutral',
    favorite: Boolean(value.favorite),
    skinTone: value.skinTone || DEFAULT_COLOR_SET.skin,
    hairColor: value.hairColor || DEFAULT_COLOR_SET.hair,
    eyeColor: value.eyeColor || DEFAULT_COLOR_SET.eyes,
    outfitColor: value.outfitColor || DEFAULT_COLOR_SET.outfit,
    accentColor: value.accentColor || DEFAULT_COLOR_SET.accent,
    outfitStyle: value.outfitStyle || 'hero',
    accessory: value.accessory || 'none',
  }
}

export function loadCharacters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return [createCharacter({ name: 'Nova' })]
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createCharacter({ name: 'Nova' })]
    }
    return parsed.map(normalizeCharacter)
  } catch {
    return [createCharacter({ name: 'Nova' })]
  }
}

export function saveCharacters(characters) {
  try {
    const payload = Array.isArray(characters) ? characters.map(normalizeCharacter) : []
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore persistence failures in restricted browser modes
  }
}

export function useStoredCharacters() {
  return useMemo(function read() {
    return loadCharacters()
  }, [])
}
