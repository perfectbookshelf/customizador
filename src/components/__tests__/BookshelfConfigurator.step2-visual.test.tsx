/**
 * Visual regression (DOM-snapshot) test:
 * For Portal, Cathedral, U-Surround — capture the Step 2 panel's rendered
 * structure (HTML) and formatted value labels (e.g. `36"`, `8' 4"`) before
 * advancing through the wizard, then again after returning from Step 5.
 *
 * Both snapshots must match exactly: layout (DOM shape) and value labels.
 */
import { describe, expect, it, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BookshelfConfigurator } from "@/components/BookshelfConfigurator"

const TYPES = ["Portal", "Cathedral", "U-Surround"] as const

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

function bumpAllSliders(presses = 3) {
  const thumbs = Array.from(document.querySelectorAll('[role="slider"]')) as HTMLElement[]
  for (const thumb of thumbs) {
    thumb.focus()
    for (let i = 0; i < presses; i++) {
      fireEvent.keyDown(thumb, { key: "ArrowRight" })
    }
  }
}

function step2Panel(): HTMLElement {
  const inner = document.querySelector(".configurator-config-inner") as HTMLElement | null
  if (!inner) throw new Error("Step body container not found")
  return inner
}

/** Strip volatile attributes (radix ids, aria values that animate, focus state). */
function normalizeHtml(root: HTMLElement): string {
  // Clone so we don't mutate the live DOM.
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll("*").forEach((el) => {
    const e = el as HTMLElement
    // Drop attributes that radix randomizes per-mount.
    for (const attr of Array.from(e.attributes)) {
      if (
        attr.name === "id" ||
        attr.name.startsWith("aria-controls") ||
        attr.name.startsWith("aria-labelledby") ||
        attr.name.startsWith("aria-describedby") ||
        attr.name.startsWith("data-radix-") ||
        attr.name === "data-state" ||
        attr.name === "tabindex"
      ) {
        e.removeAttribute(attr.name)
      }
    }
  })
  return clone.innerHTML.replace(/\s+/g, " ").trim()
}

/** Pull every formatted value label from the panel (e.g. `36"`, `8' 4"`). */
function valueLabels(root: HTMLElement): string[] {
  const text = (root.textContent ?? "").replace(/\s+/g, " ")
  // Matches  3", 36", 8' 4 1/2", 14 1/4", 8'  etc.
  const matches = text.match(/\d+(?:\s\d+\/\d+)?"|\d+'(?:\s\d+(?:\s\d+\/\d+)?")?/g) ?? []
  return matches
}

describe("Step 2 visual regression — layout + value labels survive 1→5→2 round-trip", () => {
  for (const type of TYPES) {
    it(`${type}: Step 2 DOM snapshot and formatted labels are unchanged after round-trip`, () => {
      render(<BookshelfConfigurator />)

      // Step 1 → Step 2.
      clickButtonByText(type)
      clickNav(/^next$/i)

      // Edit dimensions a bit so the snapshot reflects user input — not defaults.
      bumpAllSliders(3)

      const beforeHtml = normalizeHtml(step2Panel())
      const beforeLabels = valueLabels(step2Panel())
      expect(beforeLabels.length, `${type} should render value labels`).toBeGreaterThan(0)

      // Round-trip 2 → 5 → 2.
      clickNav(/^next$/i)        // → 3
      clickNav(/^next$/i)        // → 4
      clickNav(/^review$/i)      // → 5

      // Step 5 (Review) hides nav; use its inline ← Back.
      const reviewBack = screen.getAllByRole("button").find((b) => /back/i.test(b.textContent ?? ""))
      expect(reviewBack, "review back button").toBeTruthy()
      fireEvent.click(reviewBack!)   // → 4
      clickNav(/^back$/i)             // → 3
      clickNav(/^back$/i)             // → 2

      const afterHtml = normalizeHtml(step2Panel())
      const afterLabels = valueLabels(step2Panel())

      expect(afterLabels, `${type} formatted value labels after round-trip`).toEqual(beforeLabels)
      expect(afterHtml, `${type} Step 2 DOM after round-trip`).toBe(beforeHtml)
    })
  }
})
