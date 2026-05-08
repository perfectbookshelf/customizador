import { describe, it, expect } from "vitest"
import {
  computePortalFloorSegments,
  floorBoardCrossesObject,
  PORTAL_MIN_COL,
  type PortalGeometryInput,
} from "@/lib/portal-geometry"

const base: PortalGeometryInput = {
  wallWidth: 100,
  wallHeight: 108,
  objectWidth: 36,
  objectHeight: 82,
  floorToObject: 0,
  leftGap: 32,
  rightGap: 32,
  isDoor: true,
}

describe("Portal3DView door floor-board rules", () => {
  it("PORTAL_MIN_COL is the documented 25\" rule", () => {
    expect(PORTAL_MIN_COL).toBe(25)
  })

  it("door: never emits a floor segment that crosses the opening", () => {
    const segs = computePortalFloorSegments(base)
    expect(floorBoardCrossesObject(base)).toBe(false)
    // Two side segments, neither crossing the opening
    expect(segs).toHaveLength(2)
    for (const s of segs) {
      expect(s.x + s.w).toBeLessThanOrEqual(base.leftGap + 1e-9)
      // OR fully right of the opening
      const objR = base.leftGap + base.objectWidth
      const fullyLeft = s.x + s.w <= base.leftGap + 1e-9
      const fullyRight = s.x >= objR - 1e-9
      expect(fullyLeft || fullyRight).toBe(true)
    }
  })

  it("door: floorToObject is locked to 0 in geometry (board still split, even if upstream lifts it)", () => {
    // Even if some buggy upstream passes a non-zero floorToObject for a door,
    // isDoor=true forces effFloor=0, so the floor band is treated as intersecting
    // the door and gets split.
    const segs = computePortalFloorSegments({ ...base, floorToObject: 30 })
    expect(floorBoardCrossesObject({ ...base, floorToObject: 30 })).toBe(false)
    expect(segs.length).toBeGreaterThan(0)
    expect(segs.every(s => s.side !== "full")).toBe(true)
  })

  it("door: side segment is omitted when its gap is < 25\" (min 2-module rule)", () => {
    // Left gap too narrow → no left segment
    const segs = computePortalFloorSegments({ ...base, leftGap: 24, rightGap: 40 })
    expect(segs.find(s => s.side === "left")).toBeUndefined()
    expect(segs.find(s => s.side === "right")).toBeDefined()
  })

  it("door: BOTH side segments omitted when both gaps < 25\"", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 10, rightGap: 10, objectWidth: 80 })
    expect(segs).toHaveLength(0)
  })

  it("door: both sides emitted when both gaps >= 25\"", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 25, rightGap: 25, objectWidth: 50 })
    expect(segs).toHaveLength(2)
    expect(segs.map(s => s.side).sort()).toEqual(["left", "right"])
  })

  it("non-door object lifted off floor: emits ONE full-width floor board", () => {
    const segs = computePortalFloorSegments({
      ...base, isDoor: false, floorToObject: 30, objectHeight: 48,
    })
    expect(segs).toHaveLength(1)
    expect(segs[0].side).toBe("full")
    expect(segs[0].w).toBe(base.wallWidth)
  })

  it("non-door object on floor (e.g. fireplace): floor board still splits & omits center", () => {
    const segs = computePortalFloorSegments({
      ...base, isDoor: false, floorToObject: 0, objectWidth: 48, leftGap: 26, rightGap: 26,
    })
    expect(floorBoardCrossesObject({
      ...base, isDoor: false, floorToObject: 0, objectWidth: 48, leftGap: 26, rightGap: 26,
    })).toBe(false)
    expect(segs).toHaveLength(2)
  })
})
