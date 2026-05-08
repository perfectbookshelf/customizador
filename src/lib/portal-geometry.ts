// Pure geometry helpers for Portal3DView's floor-board layout.
// Kept in its own file so unit tests can import without pulling in three.js.

const MIN_COL = 25
const BOARD_T = 0.75
const MAX_GAP = 23

// Mirrors Portal3DView.MODULE_WIDTHS — kept in sync intentionally.
export const PORTAL_MODULE_WIDTHS = [7.25, 9.5, 11.75, 14, 16.25, 18.5, 20.75, 23]

export const PORTAL_MIN_COL = MIN_COL
export const PORTAL_BOARD_T = BOARD_T
/** Minimum modules required under any emitted board segment.
 *  A board on a single column see-saws — gravity rule. */
export const PORTAL_MIN_MODULES_PER_BOARD = 2

export interface PortalGeometryInput {
  wallWidth: number
  wallHeight: number
  objectWidth: number
  objectHeight: number
  floorToObject: number
  leftGap: number
  rightGap: number
  isDoor: boolean
}

export interface PortalBoardSegment {
  /** wall-relative x of the segment's left edge (0..wallWidth) */
  x: number
  /** segment width in inches */
  w: number
  /** which zone this segment serves */
  side: "left" | "right" | "full"
  /** number of module columns sitting under this board segment (always ≥ 2) */
  moduleCount: number
}

/** Mirrors calcModulesForWidth in Portal3DView, but always starts from index 0
 *  — matching the Portal split-board rule that each segment runs its OWN
 *  module sequence (the sequencer resets when we split a shelf into 2+ boards,
 *  same as PortalLivePreview which calls calculateBookshelf per segment). */
export function calcModulesForSegment(totalW: number): number[] {
  if (totalW < PORTAL_MODULE_WIDTHS[0] * 2) return []
  const ws: number[] = []
  let idx = 0
  ws.push(PORTAL_MODULE_WIDTHS[idx++ % PORTAL_MODULE_WIDTHS.length])
  ws.push(PORTAL_MODULE_WIDTHS[idx++ % PORTAL_MODULE_WIDTHS.length])
  let sum = ws.reduce((a, b) => a + b, 0)
  while (totalW - sum > MAX_GAP * (ws.length - 1)) {
    ws.push(PORTAL_MODULE_WIDTHS[idx++ % PORTAL_MODULE_WIDTHS.length])
    sum = ws.reduce((a, b) => a + b, 0)
  }
  while (ws.length > 1 && ws.reduce((a, b) => a + b, 0) > totalW) ws.pop()
  if (ws.length < PORTAL_MIN_MODULES_PER_BOARD) return []
  return ws
}

/** Compute the floor (y=0) board segments. Doors must NEVER have a board crossing
 *  the opening at y=0 — the door's vertical zone (objL..objR) is omitted.
 *  A side segment is only emitted when its OWN module sequence (reset per segment,
 *  same rule as the rest of the Portal split-board code) yields ≥2 modules. */
export function computePortalFloorSegments(input: PortalGeometryInput): PortalBoardSegment[] {
  const { wallWidth, objectWidth, floorToObject, leftGap, rightGap, isDoor } = input
  const objR = leftGap + objectWidth
  const effFloor = isDoor ? 0 : Math.max(0, floorToObject)

  const supports = (w: number) => calcModulesForSegment(w).length
  const tryEmit = (x: number, w: number, side: "left" | "right" | "full"): PortalBoardSegment | null => {
    const n = supports(w)
    if (n < PORTAL_MIN_MODULES_PER_BOARD) return null
    return { x, w, side, moduleCount: n }
  }

  if (effFloor > BOARD_T) {
    const seg = tryEmit(0, wallWidth, "full")
    return seg ? [seg] : []
  }
  const segs: PortalBoardSegment[] = []
  const left = tryEmit(0, leftGap, "left")
  if (left) segs.push(left)
  const right = tryEmit(objR, rightGap, "right")
  if (right) segs.push(right)
  return segs
}

/** Convenience predicate: does ANY emitted floor segment cross the object's
 *  horizontal span [objL, objR]? Always false for a valid door render. */
export function floorBoardCrossesObject(input: PortalGeometryInput): boolean {
  const objL = input.leftGap
  const objR = input.leftGap + input.objectWidth
  return computePortalFloorSegments(input).some(
    (s) => s.x < objR - 1e-9 && s.x + s.w > objL + 1e-9,
  )
}
