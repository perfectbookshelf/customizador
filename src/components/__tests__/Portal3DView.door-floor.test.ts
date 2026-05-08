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
    expect(segs).toHaveLength(2)
    const objR = base.leftGap + base.objectWidth
    for (const s of segs) {
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

  it("door: side segment is omitted when its gap is < 14.5\" (can't fit 2 modules)", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 14, rightGap: 40 })
    expect(segs.find(s => s.side === "left")).toBeUndefined()
    expect(segs.find(s => s.side === "right")).toBeDefined()
  })

  it("door: BOTH side segments omitted when neither side fits 2 modules", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 10, rightGap: 10, objectWidth: 80 })
    expect(segs).toHaveLength(0)
  })

  it("door: both sides emitted when both gaps fit ≥2 modules", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 25, rightGap: 25, objectWidth: 50 })
    expect(segs).toHaveLength(2)
    expect(segs.map(s => s.side).sort()).toEqual(["left", "right"])
    for (const s of segs) expect(s.moduleCount).toBeGreaterThanOrEqual(2)
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

describe("Portal door floor-board: exact 25\" boundary + 2-module rule", () => {
  // Smallest two modules are 7.25" each → 14.5" total. A 25" gap easily holds
  // the minimum 2-module column required to keep a floor board off the ground.
  const MIN = 25

  it("leftGap = 25 (exactly): left segment IS emitted", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: MIN, rightGap: 40 })
    const left = segs.find(s => s.side === "left")
    expect(left).toBeDefined()
    expect(left!.w).toBe(MIN)
  })

  it("leftGap = 24.999 (just below): left segment is OMITTED (no support → would fall)", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 24.999, rightGap: 40 })
    expect(segs.find(s => s.side === "left")).toBeUndefined()
    expect(segs.find(s => s.side === "right")).toBeDefined()
  })

  it("rightGap = 25 (exactly): right segment IS emitted", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 40, rightGap: MIN })
    const right = segs.find(s => s.side === "right")
    expect(right).toBeDefined()
    expect(right!.w).toBe(MIN)
  })

  it("rightGap = 24.999 (just below): right segment is OMITTED", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 40, rightGap: 24.999 })
    expect(segs.find(s => s.side === "right")).toBeUndefined()
    expect(segs.find(s => s.side === "left")).toBeDefined()
  })

  it("BOTH gaps exactly 25: both segments emitted, neither crosses the door", () => {
    const segs = computePortalFloorSegments({
      ...base, objectWidth: 50, leftGap: MIN, rightGap: MIN,
    })
    expect(segs).toHaveLength(2)
    const objL = MIN
    const objR = MIN + 50
    for (const s of segs) {
      const fullyLeft = s.x + s.w <= objL + 1e-9
      const fullyRight = s.x >= objR - 1e-9
      expect(fullyLeft || fullyRight).toBe(true)
    }
  })

  it("BOTH gaps 24.999: NO floor segments — opening would have unsupported boards", () => {
    const segs = computePortalFloorSegments({
      ...base, objectWidth: 50, leftGap: 24.999, rightGap: 24.999,
    })
    expect(segs).toHaveLength(0)
  })

  it("asymmetric exact boundary: left=25, right=24 → only left emitted", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 25, rightGap: 24, objectWidth: 51 })
    expect(segs).toHaveLength(1)
    expect(segs[0].side).toBe("left")
  })

  it("25\" gap can host the documented minimum 2-module column (2× 7.25\" = 14.5\")", () => {
    // Sanity: the 25" rule is chosen so the smallest 2-module pair fits with margin.
    // Each shelf board needs ≥2 modules to support it; the smallest module is 7.25".
    const minTwoModules = 7.25 * 2
    expect(minTwoModules).toBeLessThanOrEqual(MIN)
  })
})
