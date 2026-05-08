/**
 * Visual/structural regression for tall-door scenarios in the unified Portal flow.
 *
 * The pixel screenshot test (BookshelfConfigurator.step-screenshot.test.ts)
 * intentionally captures only the right-hand config panel because the 3D canvas
 * is non-deterministic. So for the tall-door SHELF-BOARD-SPLIT behavior we
 * verify it structurally: drive the configurator to a tall-door config, capture
 * the props handed to <Portal3DView>, then run the same pure helpers the scene
 * uses (computePortalShelfBoardSegments) and assert that:
 *
 *   1. Every emitted segment has ≥2 module columns supporting it (gravity rule).
 *   2. NO segment crosses the door's horizontal span at any board Y inside the
 *      door's vertical zone.
 *   3. Both left and right halves are exercised when their gaps support 2 modules.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"

const portalCalls: any[] = []
vi.mock("@/components/Portal3DView", () => ({
  Portal3DView: (props: any) => {
    portalCalls.push({ ...props })
    return null
  },
}))

import { render, screen, fireEvent, act } from "@testing-library/react"
import { BookshelfConfigurator } from "@/components/BookshelfConfigurator"
import {
  computePortalShelfBoardSegments,
  PORTAL_MIN_MODULES_PER_BOARD,
  PORTAL_BOARD_T,
} from "@/lib/portal-geometry"

beforeEach(() => {
  try { localStorage.clear() } catch { /* ignore */ }
  portalCalls.length = 0
})

function clickButtonByText(text: string | RegExp) {
  const btn = screen.getAllByRole("button").find((b) => {
    const t = b.textContent?.trim() ?? ""
    return typeof text === "string" ? t === text || t.startsWith(text) : text.test(t)
  })
  if (!btn) throw new Error(`No button matching ${text}`)
  fireEvent.click(btn)
}
function clickNav(label: RegExp) {
  const nav = screen.getAllByRole("button").find((b) => label.test(b.textContent?.trim() ?? ""))
  if (!nav) throw new Error(`Nav button matching ${label} not found`)
  fireEvent.click(nav)
}

function thumbs(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[role="slider"]')) as HTMLElement[]
}
function press(thumb: HTMLElement, key: string, n = 1) {
  thumb.focus()
  for (let i = 0; i < n; i++) fireEvent.keyDown(thumb, { key })
}

/** From a captured Portal3DView render, recompute the shelf-row board Y positions
 *  the scene would emit (mirrors PortalScene.rows). */
function rowsOf(props: any): { y: number; shelf: { height: number; depth: number } }[] {
  const rows: { y: number; shelf: { height: number; depth: number } }[] = []
  let y = 0
  for (const s of props.shelves) {
    const next = y + s.height + PORTAL_BOARD_T
    if (next > props.wallHeight + 0.01) break
    rows.push({ y, shelf: s })
    y = next
  }
  return rows
}

describe("Tall door: shelf board split + ≥2-module gravity rule", () => {
  it("default Portal config (door 82\", wall 108\") emits a top board that splits L/R, both supported", () => {
    render(<BookshelfConfigurator />)
    clickButtonByText("Portal")
    clickNav(/^next$/i)
    expect(portalCalls.length).toBeGreaterThan(0)
    const last = portalCalls[portalCalls.length - 1]

    // Tall door: door (82") < wall (108") and the top frame board sits inside
    // the door's vertical zone → must split L/R.
    const rows = rowsOf(last)
    const lastTop = rows.length > 0
      ? rows[rows.length - 1].y + PORTAL_BOARD_T + rows[rows.length - 1].shelf.height
      : last.wallHeight

    const objBot = last.floorToObject
    const objTop = last.floorToObject + last.objectHeight

    const topSegs = computePortalShelfBoardSegments({
      wallWidth: last.wallWidth,
      leftGap: last.leftGap,
      rightGap: last.rightGap,
      objectWidth: last.objectWidth,
      objectBot: objBot,
      objectTop: objTop,
      boardY: lastTop,
    })

    // Default seeds give wide-enough gaps on both sides.
    expect(topSegs.map(s => s.side).sort()).toEqual(["left", "right"])
    for (const s of topSegs) {
      expect(s.moduleCount).toBeGreaterThanOrEqual(PORTAL_MIN_MODULES_PER_BOARD)
    }

    // No segment crosses the door's horizontal span.
    const objL = last.leftGap
    const objR = last.leftGap + last.objectWidth
    for (const s of topSegs) {
      const crosses = s.x < objR - 1e-9 && s.x + s.w > objL + 1e-9
      expect(crosses).toBe(false)
    }
  })

  it("INVARIANT across every shelf-row board: ≥2-module rule + no door-crossing", () => {
    render(<BookshelfConfigurator />)
    clickButtonByText("Portal")
    clickNav(/^next$/i)
    const last = portalCalls[portalCalls.length - 1]
    const rows = rowsOf(last)
    const objBot = last.floorToObject
    const objTop = last.floorToObject + last.objectHeight
    const objL = last.leftGap
    const objR = last.leftGap + last.objectWidth

    const allBoardYs: number[] = []
    for (const r of rows) {
      allBoardYs.push(r.y)                                             // bottom of row
      allBoardYs.push(r.y + PORTAL_BOARD_T + r.shelf.height)           // top of row
    }
    expect(allBoardYs.length).toBeGreaterThan(0)
    for (const by of allBoardYs) {
      const segs = computePortalShelfBoardSegments({
        wallWidth: last.wallWidth, leftGap: last.leftGap, rightGap: last.rightGap,
        objectWidth: last.objectWidth, objectBot: objBot, objectTop: objTop, boardY: by,
      })
      for (const s of segs) {
        expect(s.moduleCount, `boardY=${by}, side=${s.side}, w=${s.w}`)
          .toBeGreaterThanOrEqual(PORTAL_MIN_MODULES_PER_BOARD)
        const crosses = s.x < objR - 1e-9 && s.x + s.w > objL + 1e-9
        expect(crosses, `boardY=${by} crossed door span`).toBe(false)
      }
    }
  })

  it("shrinking left gap below 2-module support: left half of overlapping board is OMITTED", () => {
    render(<BookshelfConfigurator />)
    clickButtonByText("Portal")
    clickNav(/^next$/i)

    // Push right gap to maximum so left gap collapses to ~0.
    // Slider order on Portal Step 2 (door): WallW, WallH, ObjW, ObjH, RightGap.
    const ts = thumbs()
    expect(ts.length).toBeGreaterThanOrEqual(5)
    const rGap = ts[ts.length - 1]
    act(() => press(rGap, "End"))

    const last = portalCalls[portalCalls.length - 1]
    expect(last.leftGap).toBeLessThan(16.75)

    // Top board sits inside door's zone → must split. Left half must NOT emit.
    const rows = rowsOf(last)
    const lastTop = rows.length > 0
      ? rows[rows.length - 1].y + PORTAL_BOARD_T + rows[rows.length - 1].shelf.height
      : last.wallHeight
    const segs = computePortalShelfBoardSegments({
      wallWidth: last.wallWidth, leftGap: last.leftGap, rightGap: last.rightGap,
      objectWidth: last.objectWidth,
      objectBot: last.floorToObject,
      objectTop: last.floorToObject + last.objectHeight,
      boardY: lastTop,
    })
    expect(segs.find(s => s.side === "left")).toBeUndefined()
    // Right side should still emit and be supported.
    const right = segs.find(s => s.side === "right")
    if (right) expect(right.moduleCount).toBeGreaterThanOrEqual(2)
  })
})
