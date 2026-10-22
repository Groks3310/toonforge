export const BACKGROUNDS = {
  sunset: { label: 'Sunset', sky1: '#1d2433', sky2: '#ef8a53' },
  forest: { label: 'Forest', sky1: '#1f4d3a', sky2: '#8fc78a' },
  night: { label: 'Night', sky1: '#0b1020', sky2: '#3b4a7a' },
  ocean: { label: 'Ocean', sky1: '#12395c', sky2: '#5fb7d4' },
  studio: { label: 'Studio', sky1: '#2a2a33', sky2: '#6b6b7a' },
}

export const MOODS = ['hopeful', 'happy', 'sad', 'tense', 'funny']

// The 3D robot's face only has Surprised, Sad and Angry, so happy and hopeful stay neutral.
export const MOOD_EXPRESSION = {
  hopeful: 'neutral',
  happy: 'neutral',
  sad: 'sad',
  tense: 'angry',
  funny: 'surprised',
}

export function backgroundOf(name) {
  return BACKGROUNDS[name] || BACKGROUNDS.sunset
}