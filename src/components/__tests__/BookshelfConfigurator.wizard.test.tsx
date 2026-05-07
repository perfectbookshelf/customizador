/**
 * E2E-ish render test:
 * For each "legacy" type (Portal, Cathedral, U-Surround), select it on Step 1,
 * then walk through every subsequent step. The unified WizardShell must remain
 * mounted on every step (we assert by finding the Step counter "Step N/5").
 *
 * Setup also replaces the legacy *Configurator components with throw-on-render
 * stubs, so any accidental delegation would surface as a render error.
 */
import { describe, expect, it } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import { BookshelfConfigurator } from "@/components/BookshelfConfigurator"

const TYPES = ["Portal", "Cathedral", "U-Surround"] as const

function clickButtonByText(text: string | RegExp) {
  const btn = screen.getAllByRole("button").find((b) => {
    const t = b.textContent?.trim() ?? ""
    return typeof text === "string" ? t === text || t.startsWith(text) : text.test(t)
  })
  if (!btn) throw new Error(`No button matching ${text}`)
  fireEvent.click(btn)
}

function expectUnifiedWizard(stepNum: number) {
  // WizardShell renders "Step N / total" but split across nested spans.
  // Match by walking text content of any element that has "Step" + the number.
  const candidates = Array.from(document.querySelectorAll("div, span")).filter((el) => {
    const t = (el.textContent ?? "").replace(/\s+/g, " ").trim()
    return /^Step\s*\d+\s*\/\s*\d+$/.test(t)
  })
  expect(candidates.length, `expected Step counter on step ${stepNum}`).toBeGreaterThan(0)
  const matched = candidates.some((el) =>
    new RegExp(`Step\\s*${stepNum}\\s*/`).test((el.textContent ?? "").replace(/\s+/g, " ")),
  )
  expect(matched, `expected to be on step ${stepNum}`).toBe(true)
}

describe("BookshelfConfigurator — legacy types stay in unified wizard", () => {
  for (const type of TYPES) {
    it(`${type}: every step renders the unified WizardShell, never a legacy configurator`, () => {
      render(<BookshelfConfigurator />)

      // Step 1: select the type swatch
      clickButtonByText(type)
      expectUnifiedWizard(1)

      // Walk forward through remaining steps (Type → Dimensions → Shelves → Finish → Review = 5)
      for (let n = 2; n <= 5; n++) {
        // Find Next button (renders as "Next" or "Review" on the finish step)
        const nav = screen
          .getAllByRole("button")
          .find((b) => /^next$|^review$/i.test(b.textContent?.trim() ?? ""))
        expect(nav, `Next/Review button on step ${n - 1}`).toBeTruthy()
        fireEvent.click(nav!)
        expectUnifiedWizard(n)
      }
    })
  }
})
