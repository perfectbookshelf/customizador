/**
 * Render-level test that verifies "Wood/Accent" two-tone finishes are wired
 * to the right meshes inside each 3D view.
 *
 * Strategy: render each view twice — once single-tone ("Oak") and once
 * two-tone ("Oak/White") — and assert that the only difference between the
 * two scenes is that some oak meshes flipped to white. That means: boards,
 * sides and back stayed wood, and only the baguettes took the accent.
 *
 * (This is the regression test for the bug where Bookshelf3DView swapped the
 * two parts and painted sides/boards white.)
 */
import { describe, it, expect, vi, beforeAll } from "vitest"
import { render } from "@testing-library/react"
import * as React from "react"
import { WOOD_COLORS } from "@/lib/wood-textures"

// Replace the global stubs from src/test/setup.ts so we render the real views.
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
  return { ...actual, useWoodTexture: () => null }
})

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

const OAK = WOOD_COLORS.Oak.toLowerCase()
const WHITE = WOOD_COLORS.White.toLowerCase()
const BLACK = WOOD_COLORS.Black.toLowerCase()
const MAPLE = WOOD_COLORS.Maple.toLowerCase()

function colorCounts(container: HTMLElement) {
  const counts = new Map<string, number>()
  container.querySelectorAll("meshstandardmaterial").forEach((m) => {
    const c = (m.getAttribute("color") || "").toLowerCase()
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
  })
  return counts
}

/**
 * The contract we care about: switching finish from `wood` to `wood/accent`
 * must convert a small number of baguette meshes from wood to accent — and
 * leave every other mesh alone. So the wood count must drop by exactly the
 * accent count, and no third color may appear.
 */
function assertTwoToneSplit(
  single: Map<string, number>,
  twoTone: Map<string, number>,
  wood: string,
  accent: string,
) {
  const woodSingle = single.get(wood) ?? 0
  const woodTwo = twoTone.get(wood) ?? 0
  const accentTwo = twoTone.get(accent) ?? 0

  expect(woodSingle).toBeGreaterThan(0)
  expect(accentTwo).toBeGreaterThan(0)
  // Wood count drops by exactly the accent count → baguettes flipped, the rest stayed wood.
  expect(woodTwo).toBe(woodSingle - accentTwo)
  // Single-tone has no accent; two-tone introduces no other colors.
  expect(single.get(accent) ?? 0).toBe(0)
  for (const [color, n] of twoTone) {
    if (color !== wood && color !== accent) {
      expect.fail(`unexpected color ${color} (${n}×) in two-tone render`)
    }
  }
}

describe("3D views — Wood/Accent two-tone wiring", () => {
  it("Bookshelf3DView: Oak/White flips only baguettes to white", async () => {
    const { Bookshelf3DView } = await vi.importActual<
      typeof import("@/components/Bookshelf3DView")
    >("@/components/Bookshelf3DView")
    const props = {
      style: "bookshelf" as const,
      width: 48,
      shelves: [{ height: 14, depth: 12 }],
      hideTooltip: true,
    }
    const a = render(<Bookshelf3DView {...props} finish="Oak" />)
    const b = render(<Bookshelf3DView {...props} finish="Oak/White" />)
    assertTwoToneSplit(colorCounts(a.container), colorCounts(b.container), OAK, WHITE)
  })

  it("Bookshelf3DView: Maple/Black flips only baguettes to black", async () => {
    const { Bookshelf3DView } = await vi.importActual<
      typeof import("@/components/Bookshelf3DView")
    >("@/components/Bookshelf3DView")
    const props = {
      style: "bookshelf" as const,
      width: 48,
      shelves: [{ height: 14, depth: 12 }],
      hideTooltip: true,
    }
    const a = render(<Bookshelf3DView {...props} finish="Maple" />)
    const b = render(<Bookshelf3DView {...props} finish="Maple/Black" />)
    assertTwoToneSplit(colorCounts(a.container), colorCounts(b.container), MAPLE, BLACK)
  })

  it("Cathedral3DView: Oak/White flips only baguettes to white", async () => {
    const { Cathedral3DView } = await vi.importActual<
      typeof import("@/components/Cathedral3DView")
    >("@/components/Cathedral3DView")
    const props = {
      W: 60,
      H: 80,
      H1: 30,
      direction: "center",
      rows: [
        { yPosition: 0, availableWidth: 60, shelves: [{ height: 14, depth: 12 }] },
      ],
      modulesPerRow: [[{ width: 28 }, { width: 28 }]],
      hideTooltip: true,
    }
    const a = render(<Cathedral3DView {...props} finish="Oak" />)
    const b = render(<Cathedral3DView {...props} finish="Oak/White" />)
    assertTwoToneSplit(colorCounts(a.container), colorCounts(b.container), OAK, WHITE)
  })

  it("USurround3DView: Oak/White flips only baguettes across all three arms", async () => {
    const { USurround3DView } = await vi.importActual<
      typeof import("@/components/USurround3DView")
    >("@/components/USurround3DView")
    const shelves = [{ height: 14, depth: 12 }]
    const props = {
      w1: 36, w: 60, w2: 36,
      shelvesLeft: shelves, shelvesFront: shelves, shelvesRight: shelves,
      hideTooltip: true,
    }
    const a = render(<USurround3DView {...props} finish="Oak" />)
    const b = render(<USurround3DView {...props} finish="Oak/White" />)
    assertTwoToneSplit(colorCounts(a.container), colorCounts(b.container), OAK, WHITE)
  })

  it("Portal3DView: Oak/White flips only baguettes to white", async () => {
    const { Portal3DView } = await vi.importActual<
      typeof import("@/components/Portal3DView")
    >("@/components/Portal3DView")
    const props = {
      wallWidth: 80,
      wallHeight: 90,
      objectType: "door" as const,
      objectWidth: 32,
      objectHeight: 80,
      floorToObject: 0,
      leftGap: 20,
      rightGap: 20,
      topHeight: 8,
      shelves: [{ height: 14, depth: 12 }],
      hideTooltip: true,
    }
    const a = render(<Portal3DView {...props} finish="Oak" />)
    const b = render(<Portal3DView {...props} finish="Oak/White" />)
    assertTwoToneSplit(colorCounts(a.container), colorCounts(b.container), OAK, WHITE)
  })
})
