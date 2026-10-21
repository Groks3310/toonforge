// Turns the raw output of the segmentation model into a per-pixel subject mask.
// Pure functions only (no DOM), so they can be tested outside the browser.

// Smooth 0..1 ramp: values below `low` become 0, above `high` become 1.
function smoothstep(low, high, value) {
  if (value <= low) {
    return 0
  }
  if (value >= high) {
    return 1
  }
  const t = (value - low) / (high - low)
  return t * t * (3 - 2 * t)
}

// raw:     Float32Array(size * size), values 0..1, the model's view of the image
//          after it was stretched to size x size.
// width / height: the framed image the mask is for.
// zoom:   the framing zoom (same transform drawFramed applies around the center).
// Returns Uint8Array(width * height) with 0 = background and 255 = subject.
export function buildSubjectMask(raw, size, width, height, zoom = 1) {
  const mask = new Uint8Array(width * height)
  const z = Math.max(1, zoom)

  // Where each output column/row lands in the raw model grid.
  const columns = new Float32Array(width)
  for (let x = 0; x < width; x += 1) {
    const u = ((x + 0.5 - width / 2) / z + width / 2) / width
    columns[x] = Math.min(size - 1, Math.max(0, u * size - 0.5))
  }

  for (let y = 0; y < height; y += 1) {
    const v = ((y + 0.5 - height / 2) / z + height / 2) / height
    const fy = Math.min(size - 1, Math.max(0, v * size - 0.5))
    const y0 = Math.floor(fy)
    const y1 = Math.min(size - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < width; x += 1) {
      const fx = columns[x]
      const x0 = Math.floor(fx)
      const x1 = Math.min(size - 1, x0 + 1)
      const tx = fx - x0
      const top = raw[y0 * size + x0] * (1 - tx) + raw[y0 * size + x1] * tx
      const bottom = raw[y1 * size + x0] * (1 - tx) + raw[y1 * size + x1] * tx
      const value = top * (1 - ty) + bottom * ty
      // The model gives soft edges and faint patches inside the subject.
      // This ramp keeps solid areas fully opaque and gives crisp, clean edges.
      mask[y * width + x] = Math.round(smoothstep(0.25, 0.6, value) * 255)
    }
  }
  return mask
}