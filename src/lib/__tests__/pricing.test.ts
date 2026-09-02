import { describe, expect, it } from "vitest"
import { computeAreaSqFt, computePrice } from "../pricing"

const OAK = 73.63
const WALNUT = 85.67

describe("area & price by product type", () => {
  it("bookshelf: height x width", () => {
    const area = computeAreaSqFt({ type: "bookshelf", totalHeight: 60, width: 48 })
    expect(area).toBeCloseTo((60 * 48) / 144, 6) // 20 sq ft
    expect(computePrice({ type: "bookshelf", totalHeight: 60, width: 48 }, OAK)).toBeCloseTo(20 * OAK, 4)
  })

  it("corner (outside): both arms minus one depth overlap", () => {
    const input = {
      type: "corner" as const, totalHeight: 60, width: 48, width2: 36,
      cornerVariant: "outside" as const, maxShelfDepth: 12,
    }
    expect(computeAreaSqFt(input)).toBeCloseTo((60 * (48 + 36 - 12)) / 144, 6) // 30 sq ft
    expect(computePrice(input, OAK)).toBeCloseTo(30 * OAK, 4)
  })

  it("corner (inside): both arms, no overlap removed", () => {
    const input = {
      type: "corner" as const, totalHeight: 60, width: 48, width2: 36,
      cornerVariant: "inside" as const, maxShelfDepth: 12,
    }
    expect(computeAreaSqFt(input)).toBeCloseTo((60 * 84) / 144, 6) // 35 sq ft
  })

  it("u-surround: all three walls minus two overlaps", () => {
    const input = {
      type: "usurround" as const, totalHeight: 60, width: 70,
      uW1: 50, uW: 70, uW2: 50, maxShelfDepth: 12,
    }
    const expectedArea = (60 * (50 + 70 + 50 - 24)) / 144 // 60.8333 sq ft
    expect(computeAreaSqFt(input)).toBeCloseTo(expectedArea, 6)
    expect(computePrice(input, OAK)).toBeCloseTo(expectedArea * OAK, 4)
  })

  it("u-surround counts the side walls (much larger than a single wall)", () => {
    const u = computeAreaSqFt({
      type: "usurround", totalHeight: 60, width: 70, uW1: 50, uW: 70, uW2: 50, maxShelfDepth: 12,
    })
    const single = computeAreaSqFt({ type: "bookshelf", totalHeight: 60, width: 70 })
    expect(u).toBeGreaterThan(single * 1.9)
  })

  it("cathedral: width x average height", () => {
    const input = { type: "cathedral" as const, totalHeight: 0, width: 0, cathW: 100, cathH: 60, cathH1: 96 }
    expect(computeAreaSqFt(input)).toBeCloseTo((100 * 78) / 144, 6)
  })

  it("price scales exactly with the finish rate", () => {
    const input = {
      type: "usurround" as const, totalHeight: 60, width: 70,
      uW1: 50, uW: 70, uW2: 50, maxShelfDepth: 12,
    }
    expect(computePrice(input, WALNUT) / computePrice(input, OAK)).toBeCloseTo(WALNUT / OAK, 8)
  })
})
