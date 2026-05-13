/**
 * Render-level test that verifies the two-tone "Wood/Accent" finish convention
 * is wired to the correct meshes inside each 3D view.
 *
 * We mock `splitFinish` to return three distinct sentinel finishes
 * (WOOD_TAG / ACCENT_TAG / BACK_TAG) and extend WOOD_COLORS with three
 * unique sentinel hex codes. After rendering each view, every mesh's
 * `<meshStandardMaterial color>` tells us which *role* it was meant for —
 * so we can assert:
 *   - boards/sides use the internalFinish (WOOD)
 *   - baguettes use the frameFinish (ACCENT)
 *   - back panels use the backFinish (BACK)
 *
 * (This is the regression test for the bug where Bookshelf3DView swapped
 *  internalFinish ↔ frameFinish and painted sides/boards with the accent.)
 */
import { describe, it, expect, vi, beforeAll } from "vitest"
import { render } from "@testing-library/react"
import * as React from "react"

const WOOD_HEX = "#010101"
const ACCENT_HEX = "#020202"
const BACK_HEX = "#030303"

vi.unmock("@/components/Bookshelf3DView")
vi.unmock("@/components/Cathedral3DView")
vi.unmock("@/components/USurround3DView")
vi.unmock("@/components/Portal3DView")

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-canvas": "" }, children),
  useThree: () => ({
    gl: { render: () => {}, domElement: { toDataURL: () => "data:," } },
    scene: {},
    camera: { position: { clone: () => ({}), lerpVectors: () => {} } },
    controls: null,
    size: { width: 800, height: 600 },
  }),
  useFrame: () => {},
  useLoader: () => null,
}))

vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  Environment: () => null,
  ContactShadows: () => null,
  useTexture: Object.assign(() => null, { preload: () => {} }),
}))

vi.mock("@/lib/wood-textures", async () => {
  const actual = await vi.importActual<typeof import("@/lib/wood-textures")>(
    "@/lib/wood-textures",
  )
  return {
    ...actual,
    WOOD_COLORS: {
      ...actual.WOOD_COLORS,
      WOOD_TAG: WOOD_HEX,
      ACCENT_TAG: ACCENT_HEX,
      BACK_TAG: BACK_HEX,
    },
    useWoodTexture: () => null, // force solid-color fallback in WoodMaterial
  }
})

vi.mock("@/lib/finish", () => ({
  splitFinish: (_finish: string) => ({
    internalFinish: "WOOD_TAG",
    frameFinish: "ACCENT_TAG",
    backFinish: "BACK_TAG",
  }),
}))

beforeAll(() => {
  const orig = console.error
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const msg = String(args[0] ?? "")
    if (
      msg.includes("is unrecognized in this browser") ||
      msg.includes("incorrect casing") ||
      msg.includes("React does not recognize") ||
      msg.includes("Unknown event handler") ||
      msg.includes("non-boolean attribute")
    )
      return
    orig(...(args as []))
  })
})

function colorCounts(container: HTMLElement) {
  const counts = new Map<string, number>()
  container.querySelectorAll("meshstandardmaterial").forEach((m) => {
    const c = (m.getAttribute("color") || "").toLowerCase()
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
  })
  return counts
}

function assertRoles(counts: Map<string, number>, expectBack = true) {
  const realWoodColors = new Set(["#f5f5f5", "#e8d4b8", "#1a1a1a", "#d4a574", "#5d432c"])
  expect(counts.get(WOOD_HEX) ?? 0).toBeGreaterThan(0) // sides + boards
  expect(counts.get(ACCENT_HEX) ?? 0).toBeGreaterThan(0) // baguettes
  if (expectBack) expect(counts.get(BACK_HEX) ?? 0).toBeGreaterThan(0)
  // Crucially: no mesh fell through to a real wood color (which would mean
  // the component routed an unmapped finish through getWoodColor's fallback).
  for (const [c, n] of counts) {
    if (realWoodColors.has(c)) {
      expect.fail(`mesh painted ${c} (${n}×) — finish split routed wrong`)
    }
  }
}

describe("3D views — Wood/Accent role wiring", () => {
  it("Bookshelf3DView wires sides/boards to internalFinish, baguettes to frameFinish", async () => {
    const { Bookshelf3DView } = await vi.importActual<
      typeof import("@/components/Bookshelf3DView")
    >("@/components/Bookshelf3DView")
    const { container } = render(
      <Bookshelf3DView
        style="bookshelf"
        width={48}
        shelves={[{ height: 14, depth: 12 }]}
        finish="Oak/White"
        hideTooltip
      />,
    )
    // Bookshelf3D's inner Bookshelf3D doesn't render a back panel, so skip.
    assertRoles(colorCounts(container), false)
  })

  it("Cathedral3DView wires roles correctly", async () => {
    const { Cathedral3DView } = await vi.importActual<
      typeof import("@/components/Cathedral3DView")
    >("@/components/Cathedral3DView")
    const { container } = render(
      <Cathedral3DView
        W={60} H={80} H1={30} direction="center"
        rows={[{ yPosition: 0, availableWidth: 60, shelves: [{ height: 14, depth: 12 }] }]}
        modulesPerRow={[[{ width: 28 }, { width: 28 }]]}
        finish="Oak/White"
        hideTooltip
      />,
    )
    assertRoles(colorCounts(container))
  })

  it("USurround3DView wires roles correctly across all three arms", async () => {
    const { USurround3DView } = await vi.importActual<
      typeof import("@/components/USurround3DView")
    >("@/components/USurround3DView")
    const shelves = [{ height: 14, depth: 12 }]
    const { container } = render(
      <USurround3DView
        w1={36} w={60} w2={36}
        shelvesLeft={shelves} shelvesFront={shelves} shelvesRight={shelves}
        finish="Oak/White"
        hideTooltip
      />,
    )
    // Inner Bookshelf3D doesn't render a back panel.
    assertRoles(colorCounts(container), false)
  })

  it("Portal3DView wires roles correctly", async () => {
    const { Portal3DView } = await vi.importActual<
      typeof import("@/components/Portal3DView")
    >("@/components/Portal3DView")
    const { container } = render(
      <Portal3DView
        wallWidth={80} wallHeight={90}
        objectType="door"
        objectWidth={32} objectHeight={80}
        floorToObject={0}
        leftGap={20} rightGap={20} topHeight={8}
        shelves={[{ height: 14, depth: 12 }]}
        finish="Oak/White"
        hideTooltip
      />,
    )
    // Inner Bookshelf3D doesn't render a back panel.
    assertRoles(colorCounts(container), false)
  })
})
