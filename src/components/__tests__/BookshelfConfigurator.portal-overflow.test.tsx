/**
 * Property-based test: for randomized slider sequences on Portal Step 2,
 * the props handed to Portal3DView must NEVER describe an object overflowing
 * the wall — both for forward edits AND when the wall is later shrunk.
 *
 * Invariants checked on every captured render:
 *   - 0 <= objectWidth  <= wallWidth
 *   - 0 <= objectHeight <= wallHeight
 *   - 0 <= floorToObject and floorToObject + objectHeight <= wallHeight
 *   - 0 <= leftGap, rightGap and objectWidth + leftGap + rightGap <= wallWidth
 */
import { describe, expect, it, beforeEach, vi } from "vitest"

const portalCalls: any[] = []
vi.mock("@/components/Portal3DView", () => ({
  Portal3DView: (props: any) => {
    portalCalls.push({ ...props })
    return null
  },
}))

import { render, screen, fireEvent, act } from "@testing-library/react"
import { BookshelfConfigurator } from "@/components/BookshelfConfigurator"

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
function press(thumb: HTMLElement, key: "ArrowRight" | "ArrowLeft" | "Home" | "End", n = 1) {
  thumb.focus()
  for (let i = 0; i < n; i++) fireEvent.keyDown(thumb, { key })
}

function assertNoOverflow(label: string) {
  expect(portalCalls.length, `${label}: at least one Portal3DView render`).toBeGreaterThan(0)
  for (const c of portalCalls) {
    const { wallWidth, wallHeight, objectWidth, objectHeight, floorToObject, leftGap, rightGap } = c
    const ctx = `${label} | wall=${wallWidth}x${wallHeight} obj=${objectWidth}x${objectHeight} f2o=${floorToObject} L=${leftGap} R=${rightGap}`
    expect(objectWidth, ctx).toBeGreaterThanOrEqual(0)
    expect(objectHeight, ctx).toBeGreaterThanOrEqual(0)
    expect(floorToObject, ctx).toBeGreaterThanOrEqual(0)
    expect(leftGap, ctx).toBeGreaterThanOrEqual(0)
    expect(rightGap, ctx).toBeGreaterThanOrEqual(0)
    expect(objectWidth, `width fits | ${ctx}`).toBeLessThanOrEqual(wallWidth + 1e-6)
    expect(objectHeight, `height fits | ${ctx}`).toBeLessThanOrEqual(wallHeight + 1e-6)
    expect(floorToObject + objectHeight, `vertical fits | ${ctx}`).toBeLessThanOrEqual(wallHeight + 1e-6)
    expect(objectWidth + leftGap + rightGap, `horizontal fits | ${ctx}`).toBeLessThanOrEqual(wallWidth + 1e-6)
  }
}

// Seeded RNG for deterministic randomness.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("Portal Step 2: object never overflows the wall (randomized)", () => {
  it("forward random edits never produce an overflowing 3D-view prop snapshot", () => {
    const rand = mulberry32(20260507)
    render(<BookshelfConfigurator />)
    clickButtonByText("Portal"); clickNav(/^next$/i); clickButtonByText("WINDOW"); — REPLACE
    clickNav(/^next$/i)

    // Run 30 random "moves": pick a random slider, press arrow keys a random number of times.
    for (let move = 0; move < 30; move++) {
      const ts = thumbs()
      expect(ts.length, "Portal Step 2 should expose sliders").toBeGreaterThan(0)
      const idx = Math.floor(rand() * ts.length)
      const dir = rand() < 0.5 ? "ArrowRight" : "ArrowLeft"
      const presses = 1 + Math.floor(rand() * 30)
      act(() => press(ts[idx], dir as any, presses))
    }
    assertNoOverflow("forward-random")
  })

  it("shrinking wall after maxing out object dims still keeps object inside wall", () => {
    render(<BookshelfConfigurator />)
    clickButtonByText("Portal"); clickNav(/^next$/i); clickButtonByText("WINDOW"); — REPLACE
    clickNav(/^next$/i)

    // Slider DOM order on Portal Step 2 is: WallW, WallH, ObjW, ObjH, Floor→Obj, RightGap.
    const [wallW, wallH, objW, objH, f2o, rGap] = thumbs()
    expect(wallW && wallH && objW && objH && f2o && rGap).toBeTruthy()

    // Push wall to maximum, then push object dims and gaps to maximum.
    act(() => press(wallW, "End"))
    act(() => press(wallH, "End"))
    act(() => press(objW, "End"))
    act(() => press(objH, "End"))
    act(() => press(f2o, "End"))
    act(() => press(rGap, "End"))
    assertNoOverflow("after-max")

    // Now SHRINK the wall aggressively. Re-query thumbs each time
    // because radix may re-render with different aria bounds.
    for (let i = 0; i < 20; i++) {
      const ts = thumbs()
      act(() => press(ts[0], "ArrowLeft", 10)) // shrink wall width
      act(() => press(ts[1], "ArrowLeft", 10)) // shrink wall height
    }
    assertNoOverflow("after-shrink")

    // Drive the wall all the way down to its minimum and re-check.
    act(() => press(thumbs()[0], "Home"))
    act(() => press(thumbs()[1], "Home"))
    assertNoOverflow("after-min")
  })

  it("randomized interleaving of wall-shrink and object-grow stays bounded", () => {
    const rand = mulberry32(42)
    render(<BookshelfConfigurator />)
    clickButtonByText("Portal"); clickNav(/^next$/i); clickButtonByText("WINDOW"); — REPLACE
    clickNav(/^next$/i)

    for (let move = 0; move < 60; move++) {
      const ts = thumbs()
      // Bias: 40% wall shrink, 40% object grow, 20% random nudge.
      const r = rand()
      if (r < 0.4) {
        const wallIdx = rand() < 0.5 ? 0 : 1
        act(() => press(ts[wallIdx], "ArrowLeft", 1 + Math.floor(rand() * 12)))
      } else if (r < 0.8) {
        const objIdx = 2 + Math.floor(rand() * 4) // objW, objH, f2o, rGap
        act(() => press(ts[objIdx], "ArrowRight", 1 + Math.floor(rand() * 20)))
      } else {
        const idx = Math.floor(rand() * ts.length)
        const dir = rand() < 0.5 ? "ArrowRight" : "ArrowLeft"
        act(() => press(ts[idx], dir as any, 1 + Math.floor(rand() * 8)))
      }
    }
    assertNoOverflow("interleaved")
  })
})
