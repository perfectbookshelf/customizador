// Pure geometry helpers for Portal3DView's split-board layout.
// Kept in its own file so unit tests can import without pulling in three.js.

const BOARD_T = 0.75
const MAX_GAP = 23

// Mirrors Portal3DView.MODULE_WIDTHS — kept in sync intentionally.
export const PORTAL_MODULE_WIDTHS = [7.25, 9.5, 11.75, 14, 16.25, 18.5, 20.75, 23]

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
  /** Module sequencer start index (defaults to 0 — the per-segment reset rule). */
  startIdx?: number
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
  /** the actual module widths under this segment (for caller layout) */
  moduleWidths: number[]
}

/** Compute the module column widths that would fit under a board of `totalW`,
 *  starting the sequencer at `startIdx`. Mirrors calcModulesForWidth in
 *  Portal3DView. Returns [] if fewer than 2 modules fit (the gravity rule). */
export function calcModulesForSegment(totalW: number, startIdx = 0): number[] {
  if (totalW <= 0) return []
  const ws: number[] = []
  let idx = startIdx
  // Try to seed with the first two modules of the sequence.
  const w0 = PORTAL_MODULE_WIDTHS[idx % PORTAL_MODULE_WIDTHS.length]
  const w1 = PORTAL_MODULE_WIDTHS[(idx + 1) % PORTAL_MODULE_WIDTHS.length]
  if (w0 + w1 > totalW) return []
  ws.push(w0); idx++
  ws.push(w1); idx++
  let sum = ws.reduce((a, b) => a + b, 0)
  while (totalW - sum > MAX_GAP * (ws.length - 1)) {
    ws.push(PORTAL_MODULE_WIDTHS[idx++ % PORTAL_MODULE_WIDTHS.length])
    sum = ws.reduce((a, b) => a + b, 0)
  }
  while (ws.length > PORTAL_MIN_MODULES_PER_BOARD && ws.reduce((a, b) => a + b, 0) > totalW) ws.pop()
  if (ws.length < PORTAL_MIN_MODULES_PER_BOARD) return []
  if (ws.reduce((a, b) => a + b, 0) > totalW) return []
  return ws
}

/** Generic split-board computer used by both the floor band and any horizontal
 *  shelf/top board that crosses the object's vertical zone. The rule is:
 *    - if the board does NOT overlap the object → emit one full-width segment
 *      (still requires ≥2 modules);
 *    - if it DOES overlap → emit left/right segments, each only if its own
 *      module sequence (started fresh at `startIdx`, mirroring how
 *      PortalLivePreview calls calculateBookshelf per segment) yields ≥2
 *      modules. The center span across the object is never emitted.
 */
export function computeSplitBoardSegments(args: {
  wallWidth: number
  leftGap: number
  rightGap: number
  objectWidth: number
  overlapsObject: boolean
  startIdx?: number
}): PortalBoardSegment[] {
  const { wallWidth, leftGap, rightGap, objectWidth, overlapsObject } = args
  const startIdx = args.startIdx ?? 0
  const objR = leftGap + objectWidth

  const tryEmit = (x: number, w: number, side: "left" | "right" | "full"): PortalBoardSegment | null => {
    const widths = calcModulesForSegment(w, startIdx)
    if (widths.length < PORTAL_MIN_MODULES_PER_BOARD) return null
    return { x, w, side, moduleCount: widths.length, moduleWidths: widths }
  }

  if (!overlapsObject) {
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

/** Compute the floor (y=0) board segments. Doors must NEVER have a board crossing
 *  the opening at y=0 — the door's vertical zone (objL..objR) is omitted.
 *  A side segment is only emitted when its OWN module sequence (reset per segment,
 *  same rule as the rest of the Portal split-board code) yields ≥2 modules. */
export function computePortalFloorSegments(input: PortalGeometryInput): PortalBoardSegment[] {
  const { wallWidth, objectWidth, floorToObject, leftGap, rightGap, isDoor } = input
  const effFloor = isDoor ? 0 : Math.max(0, floorToObject)
  // Board occupies y in [0, BOARD_T]. If the object's bottom sits above this band,
  // the board can span the full wall.
  const overlapsObject = effFloor <= BOARD_T
  return computeSplitBoardSegments({
    wallWidth, leftGap, rightGap, objectWidth, overlapsObject,
    startIdx: input.startIdx ?? 0,
  })
}

/** Compute segments for a horizontal shelf or top board at height `boardY`,
 *  given the object's vertical zone [objBot, objTop]. Splits when the board's
 *  Y band [boardY, boardY+BOARD_T] crosses the object zone. Same ≥2-module
 *  support rule as the floor band. */
export function computePortalShelfBoardSegments(args: {
  wallWidth: number
  leftGap: number
  rightGap: number
  objectWidth: number
  objectBot: number
  objectTop: number
  boardY: number
  startIdx?: number
}): PortalBoardSegment[] {
  const { boardY, objectBot, objectTop } = args
  const overlapsObject = boardY < objectTop && boardY + BOARD_T > objectBot
  return computeSplitBoardSegments({
    wallWidth: args.wallWidth,
    leftGap: args.leftGap,
    rightGap: args.rightGap,
    objectWidth: args.objectWidth,
    overlapsObject,
    startIdx: args.startIdx ?? 0,
  })
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

/** @deprecated Kept only so any old import still resolves. The 25" heuristic
 *  has been replaced by direct ≥2-module verification. */
export const PORTAL_MIN_COL = 25
