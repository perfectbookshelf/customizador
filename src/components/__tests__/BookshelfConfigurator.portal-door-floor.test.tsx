/**
 * Bug 3 — Portal door: floorToObject must be locked to 0, and the
 * "Floor → object" slider must be hidden when objectType === "door".
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

describe("Portal door: floorToObject locked to 0", () => {
  it("door is the default object type, and every Portal3DView render has floorToObject=0", () => {
    render(<BookshelfConfigurator />)
    clickButtonByText("Portal")
    clickNav(/^next$/i)
    expect(portalCalls.length).toBeGreaterThan(0)
    for (const c of portalCalls) {
      expect(c.objectType).toBe("door")
      expect(c.floorToObject).toBe(0)
    }
  })

  it("\"Floor → object\" slider is hidden for door, visible for window", () => {
    render(<BookshelfConfigurator />)
    clickButtonByText("Portal")
    clickNav(/^next$/i)

    // Door: no slider with that label
    expect(screen.queryByText(/Floor → object/i)).toBeNull()
    // Helper text instead
    expect(screen.getByText(/door sits on the floor/i)).toBeInTheDocument()

    // Switch to Window → slider appears
    clickButtonByText(/^window$/i)
    expect(screen.getByText(/Floor → object/i)).toBeInTheDocument()
  })

  it("switching back to door from window resets floorToObject to 0", () => {
    render(<BookshelfConfigurator />)
    clickButtonByText("Portal")
    clickNav(/^next$/i)

    // Switch to Window (window preset has floorToObj=36)
    clickButtonByText(/^window$/i)
    act(() => { /* flush */ })

    // Switch back to Door
    portalCalls.length = 0
    clickButtonByText(/^door$/i)
    act(() => { /* flush */ })
    expect(portalCalls.length).toBeGreaterThan(0)
    for (const c of portalCalls) {
      expect(c.floorToObject).toBe(0)
    }
  })
})
