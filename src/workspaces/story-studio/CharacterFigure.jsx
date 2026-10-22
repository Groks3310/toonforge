// A simple 2D figure drawn from a saved character's colors. Sizes are percentages of the
// figure's box, so the same component works as a small thumbnail and as a large stage figure.
export function CharacterFigure({ character, large = false, speaking = false, index = 0, total = 1 }) {
  const style = {
    '--skin-tone': character.skinTone,
    '--hair-color': character.hairColor,
    '--eye-color': character.eyeColor,
    '--outfit-color': character.outfitColor,
  }
  if (total > 1 || large) {
    style.left = ((index + 0.5) / total) * 100 + '%'
  }
  if (large) {
    // The more characters share the stage, the smaller each one is.
    style['--figure-scale'] = Math.max(0.55, Math.min(1, 3.2 / total))
  }
  return (
    <span className="thumb-character" style={style}>
      <span className="thumb-hair" />
      <span className="thumb-head" />
      {large ? <span className={speaking ? 'thumb-mouth talking' : 'thumb-mouth'} /> : null}
      <span className="thumb-body" />
    </span>
  )
}