/**
 * Two-tone finish convention: "Wood/Accent".
 * - First part = wood (sides, back, horizontal boards)
 * - Second part = baguette / front accent
 * Single-tone finishes (no slash) use the same value for everything.
 */
export interface SplitFinish {
  internalFinish: string // sides + boards
  frameFinish: string // baguettes (front accent)
  backFinish: string // back panel
}

export function splitFinish(finish: string): SplitFinish {
  const parts = finish.includes("/") ? finish.split("/").map((s) => s.trim()) : null
  if (!parts) {
    return { internalFinish: finish, frameFinish: finish, backFinish: finish }
  }
  return {
    internalFinish: parts[0],
    frameFinish: parts[1],
    backFinish: parts[0],
  }
}
