/**
 * Square-footage math for every product type.
 * The price is always `areaSqFt * finishRatePerSqFt`.
 */
export type PricingType = "rack" | "bookshelf" | "corner" | "cathedral" | "usurround"

export interface AreaInput {
  type: PricingType
  /** Total height of the shelf stack, in inches (unused for cathedral). */
  totalHeight: number
  /** Main width, in inches. Corner: arm 1. */
  width: number
  /** Corner only: arm 2 width. */
  width2?: number
  cornerVariant?: "outside" | "inside"
  /** Deepest shelf depth, used to remove corner overlaps. */
  maxShelfDepth?: number
  /** U-Surround: left / back / right wall widths. */
  uW1?: number
  uW?: number
  uW2?: number
  /** Cathedral: wall width plus low and high heights. */
  cathW?: number
  cathH?: number
  cathH1?: number
}

export function computeAreaSqFt(input: AreaInput): number {
  const {
    type, totalHeight, width, width2 = 0, cornerVariant = "outside", maxShelfDepth = 0,
    uW1 = 0, uW = 0, uW2 = 0, cathW = 0, cathH = 0, cathH1 = 0,
  } = input

  if (type === "corner") {
    const linear = cornerVariant === "inside"
      ? width + width2
      : Math.max(0, width + width2 - maxShelfDepth)
    return (totalHeight * linear) / 144
  }

  if (type === "usurround") {
    // Three walls minus the two inside-corner overlaps.
    const linear = Math.max(0, uW1 + uW + uW2 - 2 * maxShelfDepth)
    return (totalHeight * linear) / 144
  }

  if (type === "cathedral") {
    // Sloped face: average of the low and high heights.
    return (cathW * ((cathH + cathH1) / 2)) / 144
  }

  return (totalHeight * width) / 144
}

export function computePrice(input: AreaInput, ratePerSqFt: number): number {
  return computeAreaSqFt(input) * ratePerSqFt
}

export interface PriceRange {
  low: number
  high: number
}

/**
 * Early price estimate shown before the email gate: the same area priced at
 * the cheapest and the most expensive available finish, rounded outwards to
 * `roundTo` so the exact price (shown after the email) always falls inside.
 * Returns null when there is nothing to price.
 */
export function computePriceRange(
  areaSqFt: number,
  ratesPerSqFt: number[],
  roundTo = 50,
): PriceRange | null {
  const rates = ratesPerSqFt.filter((r) => Number.isFinite(r) && r > 0)
  if (!Number.isFinite(areaSqFt) || areaSqFt <= 0 || rates.length === 0) return null
  const low = Math.floor((areaSqFt * Math.min(...rates)) / roundTo) * roundTo
  const high = Math.ceil((areaSqFt * Math.max(...rates)) / roundTo) * roundTo
  return { low: Math.max(0, low), high }
}

export function formatUsd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`
}
