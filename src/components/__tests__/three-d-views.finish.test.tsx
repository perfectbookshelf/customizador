/**
 * Render-level test that verifies "Wood/Accent" two-tone finishes are wired
 * to the right meshes inside each 3D view.
 *
 * Strategy: stub @react-three/fiber + drei so r3f intrinsics render as plain
 * lowercase DOM elements in jsdom, and stub useWoodTexture to return null so
 * WoodMaterial falls back to <meshStandardMaterial color={WOOD_COLORS[finish]}>.
 * We then count the resulting `color` attributes to verify the wood color
 * dominates and the accent color appears only on baguettes.
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

// r3f Canvas / hooks → plain pass-through wrappers in jsdom.
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-canvas": "" }, children),
  useThree: () => ({
    gl: {
      render: () => {},
      domElement: { toDataURL: () => "data:," },
    },
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
    useWoodTexture: () => null, // forces solid-color fallback in WoodMaterial
  }
})

// Silence r3f intrinsics warnings (mesh, boxGeometry, meshStandardMaterial …).
beforeAll(() => {
  const orig = console.error
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const msg = String(args[0] ?? "")
    if (
      msg.includes("is unrecognized in this browser") ||
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
  const mats = container.querySelectorAll("meshstandardmaterial")
  const counts = new Map<string, number>()
  mats.forEach((m) => {
    const c = (m.getAttribute("color") || "").toLowerCase()
    if (!c) return
    counts.set(c, (counts.get(c) ?? 0) + 1)
  })
  return counts
}

describe("3D views — finish wiring (Wood/Accent)", () => {
  it("Bookshelf3DView: Oak/White → oak boards/sides/back, white baguettes", async () => {
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

    const counts = colorCounts(container)
    expect(counts.get(OAK) ?? 0).toBeGreaterThan(0)
    expect(counts.get(WHITE) ?? 0).toBeGreaterThan(0)
    // Wood (sides + back + boards) outnumbers the accent (baguettes).
    expect((counts.get(OAK) ?? 0)).toBeGreaterThan(counts.get(WHITE) ?? 0)
    // No stray third color.
    expect(counts.get(BLACK) ?? 0).toBe(0)
    expect(counts.get(MAPLE) ?? 0).toBe(0)
  })

  it("Bookshelf3DView: Maple/Black → maple wood, black baguettes", async () => {
    const { Bookshelf3DView } = await vi.importActual<
      typeof import("@/components/Bookshelf3DView")
    >("@/components/Bookshelf3DView")

    const { container } = render(
      <Bookshelf3DView
        style="bookshelf"
        width={48}
        shelves={[{ height: 14, depth: 12 }]}
        finish="Maple/Black"
        hideTooltip
      />,
    )

    const counts = colorCounts(container)
    expect(counts.get(MAPLE) ?? 0).toBeGreaterThan(counts.get(BLACK) ?? 0)
    expect(counts.get(BLACK) ?? 0).toBeGreaterThan(0)
    expect(counts.get(OAK) ?? 0).toBe(0)
    expect(counts.get(WHITE) ?? 0).toBe(0)
  })

  it("Cathedral3DView: Oak/White → oak dominant, white only on baguettes", async () => {
    const { Cathedral3DView } = await vi.importActual<
      typeof import("@/components/Cathedral3DView")
    >("@/components/Cathedral3DView")

    const { container } = render(
      <Cathedral3DView
        W={60}
        H={80}
        H1={30}
        direction="center"
        rows={[
          {
            yPosition: 0,
            availableWidth: 60,
            shelves: [{ height: 14, depth: 12 }],
          },
        ]}
        modulesPerRow={[[{ width: 28 }, { width: 28 }]]}
        finish="Oak/White"
        hideTooltip
      />,
    )

    const counts = colorCounts(container)
    expect(counts.get(OAK) ?? 0).toBeGreaterThan(counts.get(WHITE) ?? 0)
    expect(counts.get(WHITE) ?? 0).toBeGreaterThan(0)
  })

  it("USurround3DView: Oak/White → oak dominant across all three arms", async () => {
    const { USurround3DView } = await vi.importActual<
      typeof import("@/components/USurround3DView")
    >("@/components/USurround3DView")

    const shelves = [{ height: 14, depth: 12 }]
    const { container } = render(
      <USurround3DView
        w1={36}
        w={60}
        w2={36}
        shelvesLeft={shelves}
        shelvesFront={shelves}
        shelvesRight={shelves}
        finish="Oak/White"
        hideTooltip
      />,
    )

    const counts = colorCounts(container)
    expect(counts.get(OAK) ?? 0).toBeGreaterThan(counts.get(WHITE) ?? 0)
    expect(counts.get(WHITE) ?? 0).toBeGreaterThan(0)
  })

  it("Portal3DView: Oak/White → oak dominant, white only on baguettes", async () => {
    const { Portal3DView } = await vi.importActual<
      typeof import("@/components/Portal3DView")
    >("@/components/Portal3DView")

    const { container } = render(
      <Portal3DView
        wallWidth={80}
        wallHeight={90}
        objectType="door"
        objectWidth={32}
        objectHeight={80}
        objectXPosition={24}
        floorToObject={0}
        shelves={[{ height: 14, depth: 12 }]}
        finish="Oak/White"
        hideTooltip
      />,
    )

    const counts = colorCounts(container)
    expect(counts.get(OAK) ?? 0).toBeGreaterThan(counts.get(WHITE) ?? 0)
    expect(counts.get(WHITE) ?? 0).toBeGreaterThan(0)
  })
})
