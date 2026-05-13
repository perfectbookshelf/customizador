import { describe, it, expect } from "vitest"
import { splitFinish } from "../finish"

describe("splitFinish — two-tone convention", () => {
  it("White Oak (single tone) = oak everywhere", () => {
    expect(splitFinish("Oak")).toEqual({
      internalFinish: "Oak",
      frameFinish: "Oak",
      backFinish: "Oak",
    })
  })

  it("Maple (single tone) = maple everywhere", () => {
    expect(splitFinish("Maple")).toEqual({
      internalFinish: "Maple",
      frameFinish: "Maple",
      backFinish: "Maple",
    })
  })

  it("Walnut (single tone) = walnut everywhere", () => {
    expect(splitFinish("Walnut")).toEqual({
      internalFinish: "Walnut",
      frameFinish: "Walnut",
      backFinish: "Walnut",
    })
  })

  it("Oak/White = oak boards/sides/back, white baguettes", () => {
    expect(splitFinish("Oak/White")).toEqual({
      internalFinish: "Oak",
      frameFinish: "White",
      backFinish: "Oak",
    })
  })

  it("Oak/Black = oak boards/sides/back, black baguettes", () => {
    expect(splitFinish("Oak/Black")).toEqual({
      internalFinish: "Oak",
      frameFinish: "Black",
      backFinish: "Oak",
    })
  })

  it("Maple/Black = maple boards/sides/back, black baguettes", () => {
    expect(splitFinish("Maple/Black")).toEqual({
      internalFinish: "Maple",
      frameFinish: "Black",
      backFinish: "Maple",
    })
  })

  it("tolerates whitespace around the slash", () => {
    expect(splitFinish("Oak / White")).toEqual({
      internalFinish: "Oak",
      frameFinish: "White",
      backFinish: "Oak",
    })
  })

  it("Oak/Oak collapses to a single-tone look", () => {
    const r = splitFinish("Oak/Oak")
    expect(r.internalFinish).toBe("Oak")
    expect(r.frameFinish).toBe("Oak")
    expect(r.backFinish).toBe("Oak")
  })
})
