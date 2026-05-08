/**
 * Regression tests for the ≥2-module gravity rule across:
 *   - randomized module sequencer start indices
 *   - the top/shelf board splitter (left half AND right half)
 */
import { describe, it, expect } from "vitest"
import {
  calcModulesForSegment,
  computePortalShelfBoardSegments,
  computeSplitBoardSegments,
  computePortalFloorSegments,
  PORTAL_MIN_MODULES_PER_BOARD,
  PORTAL_MODULE_WIDTHS,
  type PortalGeometryInput,
} from "@/lib/portal-geometry"

const base: PortalGeometryInput = {
  wallWidth: 120, wallHeight: 108,
  objectWidth: 36, objectHeight: 82,
  floorToObject: 0,
  leftGap: 42, rightGap: 42,
  isDoor: true,
}

describe("≥2-module gravity rule: randomized start indices", () => {
  it("calcModulesForSegment never returns 1 module across all start indices, all widths", () => {
    for (let startIdx = 0; startIdx < PORTAL_MODULE_WIDTHS.length; startIdx++) {
      for (let w = 0; w <= 240; w += 0.25) {
        const widths = calcModulesForSegment(w, startIdx)
        expect(widths.length === 0 || widths.length >= PORTAL_MIN_MODULES_PER_BOARD,
          `start=${startIdx}, w=${w}, widths=${JSON.stringify(widths)}`).toBe(true)
        // And the column actually fits.
        const sum = widths.reduce((a, b) => a + b, 0)
        expect(sum, `start=${startIdx}, w=${w}`).toBeLessThanOrEqual(w + 1e-9)
      }
    }
  })

  it("floor segments: every emitted segment has ≥2 modules under it for any start index", () => {
    for (let startIdx = 0; startIdx < PORTAL_MODULE_WIDTHS.length; startIdx++) {
      for (let leftGap = 0; leftGap <= 80; leftGap += 1) {
        for (let rightGap = 0; rightGap <= 80; rightGap += 1) {
          const segs = computePortalFloorSegments({
            ...base, leftGap, rightGap, startIdx,
          })
          for (const s of segs) {
            expect(s.moduleCount,
              `start=${startIdx}, L=${leftGap}, R=${rightGap}, side=${s.side}, w=${s.w}`,
            ).toBeGreaterThanOrEqual(PORTAL_MIN_MODULES_PER_BOARD)
          }
        }
      }
    }
  })

  it("split-board helper: ≥2-module rule holds for both overlapping and non-overlapping cases", () => {
    for (let startIdx = 0; startIdx < PORTAL_MODULE_WIDTHS.length; startIdx++) {
      for (const overlapsObject of [true, false]) {
        for (let wallWidth = 12; wallWidth <= 240; wallWidth += 4) {
          for (let leftGap = 0; leftGap <= wallWidth; leftGap += 6) {
            const objectWidth = Math.min(40, wallWidth - leftGap)
            const rightGap = Math.max(0, wallWidth - leftGap - objectWidth)
            const segs = computeSplitBoardSegments({
              wallWidth, leftGap, rightGap, objectWidth, overlapsObject, startIdx,
            })
            for (const s of segs) {
              expect(s.moduleCount).toBeGreaterThanOrEqual(PORTAL_MIN_MODULES_PER_BOARD)
            }
          }
        }
      }
    }
  })
})

describe("Top/shelf board split: ≥2-module rule on BOTH halves around tall door", () => {
  // Tall door scenario: door extends above the top board. The top board's Y
  // (lastTop) sits inside the object's vertical zone, so it must split L/R.
  const tallDoor = {
    wallWidth: 120,
    leftGap: 42, rightGap: 42, objectWidth: 36,
    objectBot: 0, objectTop: 90,    // door top at 90"
    boardY: 84,                      // top frame board sitting at 84" (inside door zone)
  }

  it("emits BOTH left and right segments when both gaps support 2 modules", () => {
    const segs = computePortalShelfBoardSegments(tallDoor)
    expect(segs.map(s => s.side).sort()).toEqual(["left", "right"])
    for (const s of segs) {
      expect(s.moduleCount).toBeGreaterThanOrEqual(PORTAL_MIN_MODULES_PER_BOARD)
    }
  })

  it("LEFT half: omitted when leftGap < 2-module minimum (16.75\")", () => {
    const segs = computePortalShelfBoardSegments({ ...tallDoor, leftGap: 16 })
    expect(segs.find(s => s.side === "left")).toBeUndefined()
    const right = segs.find(s => s.side === "right")
    expect(right).toBeDefined()
    expect(right!.moduleCount).toBeGreaterThanOrEqual(2)
  })

  it("RIGHT half: omitted when rightGap < 2-module minimum", () => {
    const segs = computePortalShelfBoardSegments({ ...tallDoor, rightGap: 16 })
    expect(segs.find(s => s.side === "right")).toBeUndefined()
    expect(segs.find(s => s.side === "left")).toBeDefined()
  })

  it("BOTH halves omitted when neither gap fits 2 modules → empty (top board not built)", () => {
    const segs = computePortalShelfBoardSegments({
      ...tallDoor, leftGap: 12, rightGap: 12, objectWidth: 96,
    })
    expect(segs).toHaveLength(0)
  })

  it("non-overlapping (board sits above door): emits one full-width segment", () => {
    // boardY above objectTop → does not overlap, full board.
    const segs = computePortalShelfBoardSegments({ ...tallDoor, boardY: 100 })
    expect(segs).toHaveLength(1)
    expect(segs[0].side).toBe("full")
    expect(segs[0].w).toBe(tallDoor.wallWidth)
  })

  it("INVARIANT sweep: tall-door top-board split, every emitted side has ≥2 modules", () => {
    for (let leftGap = 0; leftGap <= 60; leftGap += 0.5) {
      for (let rightGap = 0; rightGap <= 60; rightGap += 0.5) {
        const segs = computePortalShelfBoardSegments({
          wallWidth: leftGap + 36 + rightGap,
          leftGap, rightGap, objectWidth: 36,
          objectBot: 0, objectTop: 90, boardY: 84,
        })
        for (const s of segs) {
          expect(s.moduleCount,
            `L=${leftGap}, R=${rightGap}, side=${s.side}, w=${s.w}`,
          ).toBeGreaterThanOrEqual(PORTAL_MIN_MODULES_PER_BOARD)
        }
      }
    }
  })
})

describe("MIN_COL heuristic removed: 25\" is no longer special", () => {
  // The old code emitted a side board when gap ≥ 25" regardless of module count.
  // After refactor, the only thing that matters is whether the segment can host
  // ≥2 modules. Verify a gap ≥ 25" does NOT short-circuit if (somehow) 2 modules
  // wouldn't fit — and that the true minimum (16.75") is what gates emission.
  it("threshold is exactly 16.75\", not 25\"", () => {
    expect(calcModulesForSegment(16.74).length).toBe(0)
    expect(calcModulesForSegment(16.75).length).toBeGreaterThanOrEqual(2)
    // 25" — the OLD heuristic — also passes, but for the right reason now (≥2 modules)
    expect(calcModulesForSegment(25).length).toBeGreaterThanOrEqual(2)
  })
})
