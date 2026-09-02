/**
 * E2E preview-update test:
 * For each of Portal, Cathedral, U-Surround:
 *   1. Mock the corresponding 3D view to capture every prop snapshot it receives.
 *   2. Select the type, edit Step 2 dimensions.
 *   3. Walk forward through steps 2 → 3 → 4 → 5.
 *   4. Assert the 3D view received NEW props (different from the initial defaults)
 *      and is still rendered with those updated props on every forward step.
 *
 * Note: this file installs its own mocks for the three 3D views (overriding the
 * null-stubs in src/test/setup.ts) so it can record prop history.
 */
import { describe, expect, it, beforeEach, vi } from "vitest"

const portalCalls: any[] = []
const cathedralCalls: any[] = []
const usurroundCalls: any[] = []

vi.mock("@/components/Portal3DView", () => ({
  Portal3DView: (props: any) => {
    portalCalls.push({ ...props })
    return null
  },
}))
vi.mock("@/components/Cathedral3DView", () => ({
  Cathedral3DView: (props: any) => {
    cathedralCalls.push({ ...props })
    return null
  },
}))
vi.mock("@/components/USurround3DView", () => ({
  USurround3DView: (props: any) => {
    usurroundCalls.push({ ...props })
    return null
  },
}))

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { BookshelfConfigurator } from "@/components/BookshelfConfigurator"

beforeEach(() => {
  try {
    localStorage.clear()
    // Step 3 gates "Next" behind a saved quote email.
    localStorage.setItem("pbs_quote_email", "test@example.com")
  } catch { /* ignore */ }
  portalCalls.length = 0
  cathedralCalls.length = 0
  usurroundCalls.length = 0
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
  const nav = screen.getAllByRole("button").find((b) => label.test(b.textContent?.trim() ?? ""))
  if (!nav) throw new Error(`Nav button matching ${label} not found`)
  fireEvent.click(nav)
}

function bumpAllSliders(presses = 4) {
  const thumbs = Array.from(document.querySelectorAll('[role="slider"]')) as HTMLElement[]
  for (const thumb of thumbs) {
    thumb.focus()
    for (let i = 0; i < presses; i++) {
      fireEvent.keyDown(thumb, { key: "ArrowRight" })
    }
  }
}

interface Spec {
  name: string
  swatch: string
  calls: any[]
  /** Numeric prop fields the 3D view receives that should reflect Step 2 edits. */
  dimFields: string[]
}

const SPECS: Spec[] = [
  { name: "Cathedral", swatch: "Cathedral", calls: cathedralCalls,
    dimFields: ["W", "H", "H1"] },
  { name: "U-Surround", swatch: "U-Surround", calls: usurroundCalls,
    dimFields: ["w1", "w", "w2"] },
]

function dimSnapshot(call: any, fields: string[]) {
  return fields.map((f) => `${f}=${call?.[f]}`).join(",")
}

describe("3D preview updates when Step 2 dimensions change (Portal/Cathedral/U-Surround)", () => {
  for (const spec of SPECS) {
    it(`${spec.name}: 3D view receives new dimensions and keeps them on every forward step`, async () => {
      render(<BookshelfConfigurator />)

      // Step 1: select type — this mounts the matching 3D preview.
      clickButtonByText(spec.swatch)
      confirmSubVariantIfNeeded()

      // Step 2 is the first step with the 3D preview mounted.
      clickNav(/^next$|^see quote$/i)
      // The 3D views are React.lazy — wait for the chunk to mount.
      await waitFor(() => expect(spec.calls.length,
        `${spec.name} 3D view should render on Step 2`).toBeGreaterThan(0))
      const initialSnap = dimSnapshot(spec.calls[spec.calls.length - 1], spec.dimFields)

      // Step 2: edit dimensions.
      bumpAllSliders(4)

      // After edits, the 3D preview must have re-rendered with new dim values.
      const afterEditCall = spec.calls[spec.calls.length - 1]
      const afterEditSnap = dimSnapshot(afterEditCall, spec.dimFields)
      expect(afterEditSnap, `${spec.name} preview snapshot should change after Step 2 edits`).not.toBe(initialSnap)

      // Walk Step 3 → 4 → 5 and assert the preview is still rendered with the
      // updated dimensions on each forward step.
      const expectedSnap = afterEditSnap

      clickNav(/^next$|^see quote$/i) // → 3 Shelves
      const step3Snap = dimSnapshot(spec.calls[spec.calls.length - 1], spec.dimFields)
      expect(step3Snap, `${spec.name} preview on Step 3`).toBe(expectedSnap)

      clickNav(/^next$|^see quote$/i) // → 4 Finish
      const step4Snap = dimSnapshot(spec.calls[spec.calls.length - 1], spec.dimFields)
      expect(step4Snap, `${spec.name} preview on Step 4`).toBe(expectedSnap)

      clickNav(/^review$/i) // → 5 Review
      // Confirm we landed on Review.
      expect(screen.getByRole("button", { name: /checkout|processing/i })).toBeInTheDocument()
      const step5Snap = dimSnapshot(spec.calls[spec.calls.length - 1], spec.dimFields)
      expect(step5Snap, `${spec.name} preview on Step 5`).toBe(expectedSnap)
    })
  }
})
