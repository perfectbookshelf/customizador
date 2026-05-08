// Pure geometry helpers for Portal3DView's floor-board layout.
// Kept in its own file so unit tests can import without pulling in three.js.

const MIN_COL = 25
const BOARD_T = 0.75

export const PORTAL_MIN_COL = MIN_COL
export const PORTAL_BOARD_T = BOARD_T

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
}

/** Compute the floor (y=0) board segments. Doors must NEVER have a board crossing
 *  the opening at y=0 — the door's vertical zone (objL..objR) is omitted, and
 *  side segments are only emitted when the side gap is wide enough to host a
 *  two-module column (>= PORTAL_MIN_COL = 25"). */
export function computePortalFloorSegments(input: PortalGeometryInput): PortalBoardSegment[] {
  const { wallWidth, objectWidth, floorToObject, leftGap, rightGap, isDoor } = input
  const objR = leftGap + objectWidth
  const effFloor = isDoor ? 0 : Math.max(0, floorToObject)
  if (effFloor > BOARD_T) {
    return [{ x: 0, w: wallWidth, side: "full" }]
  }
  const segs: PortalBoardSegment[] = []
  if (leftGap >= MIN_COL) segs.push({ x: 0, w: leftGap, side: "left" })
  if (rightGap >= MIN_COL) segs.push({ x: objR, w: rightGap, side: "right" })
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
