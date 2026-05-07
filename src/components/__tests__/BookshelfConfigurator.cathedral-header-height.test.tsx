/**
 * Step 3 Cathedral header height test.
 *
 * Verifies that the "X tall" label rendered in the Step 3 header equals the
 * actual stack height computed from the visible tier rows (tier height + the
 * 0.75" cap board per tier), as derived from `computeCathedralRows`.
 */
import { describe, expect, it, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { BookshelfConfigurator } from "@/components/BookshelfConfigurator"
import { computeCathedralRows } from "@/lib/cathedral-calculator"
import type { ShelfConfig } from "@/lib/types"

beforeEach(() => {
  try { localStorage.clear() } catch { /* ignore */ }
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

/**
 * Convert a fraction string ("8' 4 1/2"", "104"", "8'") back into total inches.
 * Matches `toFraction`'s output format.
 */
function parseFraction(s: string): number {
  // Feet + remaining inches: e.g. `8' 4 1/2"` or `8'` or `8' 4"`
  const ftMatch = s.match(/^(\d+)'\s*(?:(\d+)(?:\s+(\d+)\/(\d+))?")?$/)
  if (ftMatch) {
    const ft = Number(ftMatch[1])
    const inWhole = ftMatch[2] ? Number(ftMatch[2]) : 0
    const num = ftMatch[3] ? Number(ftMatch[3]) : 0
    const den = ftMatch[4] ? Number(ftMatch[4]) : 1
    return ft * 12 + inWhole + (num / den)
  }
  // Pure inches: e.g. `36"` or `14 1/4"`
  const inMatch = s.match(/^(\d+)(?:\s+(\d+)\/(\d+))?"$/)
  if (inMatch) {
    const whole = Number(inMatch[1])
    const num = inMatch[2] ? Number(inMatch[2]) : 0
    const den = inMatch[3] ? Number(inMatch[3]) : 1
    return whole + (num / den)
  }
  throw new Error(`Unparseable fraction string: ${JSON.stringify(s)}`)
}

/** Pull the "X tall" string out of the Step 3 header (priceDelta slot). */
function readHeaderHeight(): number {
  // The wizard header shows "{number} tall" near the step title.
  // Search the entire DOM text for the pattern, since the header is a sibling of the panel.
  const root = document.body
  const text = root.textContent ?? ""
  const m = text.match(/((?:\d+'\s*(?:\d+(?:\s+\d+\/\d+)?")?)|(?:\d+(?:\s+\d+\/\d+)?"))\s+tall/)
  if (!m) throw new Error(`No "X tall" label found. DOM text snippet: ${text.slice(0, 500)}`)
  return parseFraction(m[1])
}

describe("Cathedral Step 3: header height equals summed tier heights + caps", () => {
  it("default cathedral config: header equals computed stack height", () => {
    render(<BookshelfConfigurator />)
    clickButtonByText("Cathedral")
    clickNav(/^next$/i)        // → Step 2 Dimensions
    clickNav(/^next$/i)        // → Step 3 Shelves (Tiers)

    const headerHeight = readHeaderHeight()

    // Pull current cathedral state defaults that the configurator initialized with.
    // (W=100, H=60, H1=96, 5 tiers @ height 14, depth 14 by default.)
    const shelves: ShelfConfig[] = Array(5).fill(null).map(() => ({ height: 14, depth: 14 }))
    const rows = computeCathedralRows(100, 60, 96, shelves, "left")
    const expected = rows.reduce((sum, r) => sum + r.shelves[0].height + 0.75, 0)

    expect(rows.length, "default cathedral should render some tiers").toBeGreaterThan(0)
    expect(Math.abs(headerHeight - expected), `header=${headerHeight}, expected=${expected}`).toBeLessThan(0.01)
  })

  it("after adding two more tiers: header still tracks visible-tier stack height", () => {
    render(<BookshelfConfigurator />)
    clickButtonByText("Cathedral")
    clickNav(/^next$/i)
    clickNav(/^next$/i)

    // Press the "+" Number-of-tiers stepper twice (find by adjacency to the label).
    const numberRow = Array.from(document.querySelectorAll("div")).find(
      (d) => d.textContent?.includes("Number of tiers")
    ) as HTMLElement | undefined
    expect(numberRow, "number-of-tiers row").toBeTruthy()
    const plus = within(numberRow!).getAllByRole("button").pop()!
    fireEvent.click(plus)
    fireEvent.click(plus)

    const headerHeight = readHeaderHeight()

    // Now 7 tiers — but cathedral may hide top tiers above the slope ceiling.
    const shelves: ShelfConfig[] = Array(7).fill(null).map(() => ({ height: 14, depth: 14 }))
    const rows = computeCathedralRows(100, 60, 96, shelves, "left")
    const expected = rows.reduce((sum, r) => sum + r.shelves[0].height + 0.75, 0)

    expect(Math.abs(headerHeight - expected), `header=${headerHeight}, expected=${expected}, visible=${rows.length}`).toBeLessThan(0.01)
  })
})
