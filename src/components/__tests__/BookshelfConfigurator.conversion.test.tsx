/**
 * Conversion features: progress tracker, early price estimate, presets,
 * consultation link and trust list.
 */
import { describe, expect, it, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { BookshelfConfigurator } from "@/components/BookshelfConfigurator"

beforeEach(() => {
  try {
    localStorage.clear()
    localStorage.setItem("pbs_quote_email", "test@example.com")
  } catch {
    /* ignore */
  }
})

function clickNext() {
  const nav = screen
    .getAllByRole("button")
    .find((b) => /^next$|^review$|^see quote$/i.test(b.textContent?.trim() ?? ""))
  expect(nav).toBeTruthy()
  fireEvent.click(nav!)
}

function parseRange(text: string): [number, number] {
  const nums = (text.match(/\$[\d,]+/g) ?? []).map((s) => Number(s.replace(/[$,]/g, "")))
  expect(nums.length).toBeGreaterThanOrEqual(2)
  return [nums[0], nums[1]]
}

describe("BookshelfConfigurator — conversion features", () => {
  it("shows a named progress tracker and marks completed steps", () => {
    render(<BookshelfConfigurator />)
    const nav = screen.getByRole("navigation", { name: "Progress" })
    for (const label of ["Type", "Size", "Shelves", "Finish", "Review"]) {
      expect(within(nav).getByText(label)).toBeInTheDocument()
    }
    expect(within(nav).queryByRole("button")).toBeNull()

    clickNext()
    // Step 1 is now done and can be revisited from the tracker.
    const back = within(nav).getByRole("button", { name: /go back to type/i })
    fireEvent.click(back)
    expect(within(nav).queryByRole("button")).toBeNull()
  })

  it("Step 1 says how far the price is; Step 2 shows an estimate range", () => {
    render(<BookshelfConfigurator />)
    expect(screen.getByTestId("price-steps-left")).toHaveTextContent(/3 steps away/i)

    clickNext()
    const estimate = screen.getByTestId("price-estimate")
    const [low, high] = parseRange(estimate.textContent ?? "")
    expect(low).toBeGreaterThan(0)
    expect(high).toBeGreaterThan(low)
    expect(low % 50).toBe(0)
    expect(high % 50).toBe(0)
    // Never expose square footage or per-square-foot pricing.
    expect(estimate.textContent).not.toMatch(/sq|ft²|per square/i)
  })

  it("the exact price on the Finish step falls inside the earlier estimate", () => {
    render(<BookshelfConfigurator />)
    clickNext() // → Dimensions
    clickNext() // → Shelves
    const [low, high] = parseRange(screen.getByTestId("price-estimate").textContent ?? "")
    clickNext() // → Finish (email already saved in setup)
    const priceText = screen.getAllByText(/^\$[\d.]+$/)[0].textContent ?? ""
    const exact = Number(priceText.replace("$", ""))
    expect(exact).toBeGreaterThanOrEqual(low)
    expect(exact).toBeLessThanOrEqual(high)
  })

  it("a preset applies its layout and jumps to Dimensions", () => {
    render(<BookshelfConfigurator />)
    fireEvent.click(screen.getByRole("button", { name: /start from slim tower/i }))
    // Header shows the preset width on the Dimensions step.
    expect(screen.getByText(/4' 2" wide/)).toBeInTheDocument()
    clickNext()
    // Six shelves, with the depth stepping down.
    expect(screen.getByText("Shelf 6")).toBeInTheDocument()
  })

  it("a preset of a different type keeps its own shelf count", () => {
    render(<BookshelfConfigurator />)
    fireEvent.click(screen.getByRole("button", { name: /start from library wall/i }))
    fireEvent.click(screen.getByRole("button", { name: /go back to type/i }))
    fireEvent.click(screen.getByRole("button", { name: /start from low console/i }))
    clickNext()
    expect(screen.getByText("Shelf 2")).toBeInTheDocument()
    expect(screen.queryByText("Shelf 3")).toBeNull()
  })

  it("Dimensions offers the free consultation", () => {
    render(<BookshelfConfigurator />)
    clickNext()
    expect(screen.getByRole("button", { name: /book a free consultation/i })).toBeInTheDocument()
  })

  it("Review shows delivery timeline and shipping facts next to Checkout", () => {
    render(<BookshelfConfigurator />)
    for (let i = 0; i < 4; i++) clickNext()
    const trust = screen.getByTestId("trust-list")
    expect(trust).toHaveTextContent(/25 business days/i)
    expect(trust).toHaveTextContent(/Greenwich, CT/i)
    expect(trust).toHaveTextContent(/shipping/i)
    // No reviews are configured yet, so no review blocks render.
    expect(screen.queryByTestId("review-cards")).toBeNull()
    expect(screen.queryByTestId("review-summary")).toBeNull()
  })
})
