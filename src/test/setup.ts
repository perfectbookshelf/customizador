import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// jsdom doesn't implement matchMedia / ResizeObserver / IntersectionObserver
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

class MockObs {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver ?? MockObs
;(globalThis as any).IntersectionObserver = (globalThis as any).IntersectionObserver ?? MockObs

// Stub the heavy 3D + R3F components so jsdom doesn't try to instantiate WebGL.
vi.mock("@/components/Bookshelf3DView", () => ({
  Bookshelf3DView: () => null,
}))
vi.mock("@/components/Portal3DView", () => ({
  Portal3DView: () => null,
}))
vi.mock("@/components/Cathedral3DView", () => ({
  Cathedral3DView: () => null,
}))
vi.mock("@/components/USurround3DView", () => ({
  USurround3DView: () => null,
}))
vi.mock("@/components/FloatingPreview", () => ({
  FloatingPreview: () => null,
}))

