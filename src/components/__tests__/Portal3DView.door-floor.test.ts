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

  it("door: side segment is omitted when its gap is < 16.75\" (can't fit 2 modules)", () => {
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

describe("Portal door floor-board: 2-module gravity rule (per-segment reset)", () => {
  // The Portal split-board rule resets the module sequencer for each emitted
  // segment (PortalLivePreview calls calculateBookshelf once per segment from
  // index 0). The sequencer always picks indices 0 then 1 first → smallest two
  // modules are 7.25" + 9.5" = 16.75", the true physical minimum to support a board.
  const MIN_PHYS = 16.75

  it("leftGap = 16.75 (exactly): left segment IS emitted with exactly 2 modules", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: MIN_PHYS, rightGap: 40 })
    const left = segs.find(s => s.side === "left")
    expect(left).toBeDefined()
    expect(left!.moduleCount).toBe(2)
  })

  it("leftGap = 16.74 (just below): left segment OMITTED (would see-saw on 1 module)", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 16.74, rightGap: 40 })
    expect(segs.find(s => s.side === "left")).toBeUndefined()
    expect(segs.find(s => s.side === "right")).toBeDefined()
  })

  it("rightGap = 16.75 (exactly): right segment IS emitted", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 40, rightGap: MIN_PHYS })
    const right = segs.find(s => s.side === "right")
    expect(right).toBeDefined()
    expect(right!.moduleCount).toBe(2)
  })

  it("rightGap = 16.74 (just below): right segment OMITTED", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 40, rightGap: 16.74 })
    expect(segs.find(s => s.side === "right")).toBeUndefined()
    expect(segs.find(s => s.side === "left")).toBeDefined()
  })

  it("BOTH gaps exactly 16.75: both segments emitted, both with 2 modules", () => {
    const segs = computePortalFloorSegments({
      ...base, objectWidth: 50, leftGap: MIN_PHYS, rightGap: MIN_PHYS,
    })
    expect(segs).toHaveLength(2)
    for (const s of segs) {
      expect(s.moduleCount).toBe(2)
      const objL = MIN_PHYS, objR = MIN_PHYS + 50
      const fullyLeft = s.x + s.w <= objL + 1e-9
      const fullyRight = s.x >= objR - 1e-9
      expect(fullyLeft || fullyRight).toBe(true)
    }
  })

  it("BOTH gaps 16.74: NO floor segments — boards would fall", () => {
    const segs = computePortalFloorSegments({
      ...base, objectWidth: 50, leftGap: 16.74, rightGap: 16.74,
    })
    expect(segs).toHaveLength(0)
  })

  it("asymmetric: left=16.75, right=16.74 → only left emitted", () => {
    const segs = computePortalFloorSegments({ ...base, leftGap: 16.75, rightGap: 16.74, objectWidth: 66.51 })
    expect(segs).toHaveLength(1)
    expect(segs[0].side).toBe("left")
  })

  it("INVARIANT: every emitted segment has ≥2 module columns supporting it", () => {
    // Sweep a wide range of gap widths; the gravity rule must always hold.
    for (let gap = 0; gap <= 100; gap += 0.25) {
      const segs = computePortalFloorSegments({ ...base, leftGap: gap, rightGap: gap, objectWidth: 20 })
      for (const s of segs) {
        expect(s.moduleCount, `gap=${gap}, side=${s.side}, w=${s.w}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it("non-door full-width board also requires ≥2 modules (consistent rule)", () => {
    // Wall narrower than 16.75" → no full-width board emitted.
    const segs = computePortalFloorSegments({
      ...base, isDoor: false, floorToObject: 30, wallWidth: 14, objectHeight: 8, objectWidth: 8,
    })
    expect(segs).toHaveLength(0)
  })
})
