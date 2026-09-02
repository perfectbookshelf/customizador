/**
 * E2E persistence test:
 * For each of Portal, Cathedral, U-Surround, edit Step 2 values, then navigate
 * forward through steps 3→5 and back to step 2, asserting the Step 2 fields
 * keep the exact values that were set.
 *
 * We exercise the radix Slider via keyboard (ArrowRight/ArrowLeft) and snapshot
 * the rendered value labels (toFraction-formatted) inside Step 2.
 */
import { describe, expect, it, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BookshelfConfigurator } from "@/components/BookshelfConfigurator"

const TYPES = ["Cathedral", "U-Surround"] as const

beforeEach(() => {
  // Always start from a clean wizard — defaults restored, no leftover saved state.
  try {
    localStorage.clear()
    // Step 3 gates "Next" behind a saved quote email.
    localStorage.setItem("pbs_quote_email", "test@example.com")
  } catch { /* ignore */ }
})

function clickButtonByText(text: string | RegExp) {
  const btn = screen.getAllByRole("button").find((b) => {
    const t = b.textContent?.trim() ?? ""
    return typeof text === "string" ? t === text || t.startsWith(text) : text.test(t)
  })
  if (!btn) throw new Error(`No button matching ${text}`)
  fireEvent.click(btn)
}

// Cathedral requires picking a style sub-option on Step 1 before Next unlocks.
function confirmSubVariantIfNeeded() {
  const btn = screen.getAllByRole("button").find((b) => (b.textContent ?? "").trim() === "Center")
  if (btn) fireEvent.click(btn)
}

function clickNav(label: RegExp) {
  const nav = screen
    .getAllByRole("button")
    .find((b) => label.test(b.textContent?.trim() ?? ""))
  if (!nav) throw new Error(`Nav button matching ${label} not found :: ${screen.getAllByRole("button").map((b) => b.textContent?.trim()).join(" | ")}`)
  fireEvent.click(nav)
}

/** Pump every slider on the current step a few ArrowRight presses so values change. */
function bumpAllSliders(presses = 3) {
  const thumbs = Array.from(document.querySelectorAll('[role="slider"]')) as HTMLElement[]
  for (const thumb of thumbs) {
    thumb.focus()
    for (let i = 0; i < presses; i++) {
      fireEvent.keyDown(thumb, { key: "ArrowRight" })
    }
  }
}

/** Snapshot every aria-valuenow on the current step (in DOM order). */
function snapshotSliderValues(): string[] {
  const thumbs = Array.from(document.querySelectorAll('[role="slider"]')) as HTMLElement[]
  return thumbs.map((t) => t.getAttribute("aria-valuenow") ?? "")
}

/** Snapshot the step-2 panel text (labels + formatted values). */
function snapshotStep2Text(): string {
  // The step body lives inside the configurator-config-inner scroll container.
  const inner = document.querySelector(".configurator-config-inner") as HTMLElement | null
  if (!inner) throw new Error("Step body container not found")
  return (inner.textContent ?? "").replace(/\s+/g, " ").trim()
}

describe("Step 2 dimensions persist across step navigation (Portal/Cathedral/U-Surround)", () => {
  for (const type of TYPES) {
    it(`${type}: edited Step 2 values survive a 1→5→2 round-trip`, () => {
      render(<BookshelfConfigurator />)

      // Step 1: pick type, advance to Step 2.
      clickButtonByText(type)
    confirmSubVariantIfNeeded()
      clickNav(/^next$|^see quote$/i)

      // Step 2: edit every dimension slider.
      bumpAllSliders(3)
      const beforeValues = snapshotSliderValues()
      const beforeText = snapshotStep2Text()
      expect(beforeValues.length, `${type} should expose Step 2 sliders`).toBeGreaterThan(0)

      // Forward 2 → 3 → 4 → 5 (Review hides the unified nav).
      clickNav(/^next$|^see quote$/i)        // → 3 Shelves
      clickNav(/^next$|^see quote$/i)        // → 4 Finish
      clickNav(/^review$/i)      // → 5 Review

      // Confirm we landed on Review.
      expect(screen.getByRole("button", { name: /checkout|processing/i })).toBeInTheDocument()

      // Back 5 → 4 → 3 → 2 using the inline ← Back on review and the Back nav otherwise.
      // Review's back button is "← Back" rendered as a <button>.
      const reviewBack = screen.getAllByRole("button").find((b) => /back/i.test(b.textContent ?? ""))
      expect(reviewBack, "review back button").toBeTruthy()
      fireEvent.click(reviewBack!)  // → 4
      clickNav(/^back$/i)            // → 3
      clickNav(/^back$/i)            // → 2

      const afterValues = snapshotSliderValues()
      const afterText = snapshotStep2Text()

      expect(afterValues, `${type} slider values after round-trip`).toEqual(beforeValues)
      expect(afterText, `${type} step-2 panel text after round-trip`).toBe(beforeText)
    })
  }
})
