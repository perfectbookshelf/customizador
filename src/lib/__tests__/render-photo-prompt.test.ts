import { describe, it, expect } from "vitest";
import {
  buildRenderPrompt,
  classifyRenderType,
  SUPPORTED_RENDER_TYPE_LABELS,
} from "@/lib/render-photo.functions";

const REQUIRED_PHRASES = [
  // floor contact
  "standing directly on the floor",
  "bottom edge",
  "touches the floor",
  // not floating / not wall-mounted
  "not floating",
  "not wall-mounted",
  // product-focused framing
  "main subject",
  "product-focused camera distance",
  // layout preservation
  "Preserve EXACTLY the same geometry",
];

const CASES = [
  { type: "Bookshelf", finish: "Walnut", framing: /50–65% of the image height and 45–60% of the image width/ },
  { type: "Horizontal", finish: "Walnut", framing: /65–75% of the image width/ },
  { type: "Cathedral", finish: "White Oak", framing: /55–70% of the image width/ },
] as const;

describe("buildRenderPrompt — supported types", () => {
  for (const c of CASES) {
    it(`includes all required QA phrases for ${c.type} + ${c.finish}`, () => {
      const built = buildRenderPrompt({
        typeLabel: c.type,
        finishLabel: c.finish,
        dimensions: '36" × 72"',
      });

      for (const phrase of REQUIRED_PHRASES) {
        expect(built.prompt, `missing phrase "${phrase}" for ${c.type}`).toContain(phrase);
      }
      // finish and type tokens
      expect(built.prompt).toContain(c.finish);
      expect(built.prompt).toContain(c.type);
      // type-specific framing %
      expect(built.prompt).toMatch(c.framing);

      // negative prompt covers the critical exclusions
      for (const neg of ["floating", "wall-mounted", "hovering", "cropped product", "excessive empty floor"]) {
        expect(built.negativePrompt).toContain(neg);
      }
    });
  }

  it("exposes the three supported type labels", () => {
    expect([...SUPPORTED_RENDER_TYPE_LABELS]).toEqual(["Bookshelf", "Horizontal", "Cathedral"]);
  });
});

describe("classifyRenderType — guard against unsupported types", () => {
  it.each(["Corner", "U-Surround", "Portal", "", "random string"])(
    "returns null for unsupported type %s",
    (label) => {
      expect(classifyRenderType(label)).toBeNull();
    },
  );

  it.each([
    ["Bookshelf", "bookshelf"],
    ["Horizontal", "horizontal"],
    ["Cathedral", "cathedral"],
  ] as const)("classifies %s correctly", (label, kind) => {
    expect(classifyRenderType(label)).toBe(kind);
  });

  it("buildRenderPrompt throws for unsupported types (no AI call possible)", () => {
    expect(() =>
      buildRenderPrompt({ typeLabel: "Corner", finishLabel: "Walnut", dimensions: "36 × 72" }),
    ).toThrowError(/Unsupported AI render type/);
    expect(() =>
      buildRenderPrompt({ typeLabel: "Portal", finishLabel: "Walnut", dimensions: "36 × 72" }),
    ).toThrowError(/Unsupported AI render type/);
  });
});

describe("buildRenderPrompt — carousel variants", () => {
  const base = { typeLabel: "Bookshelf", finishLabel: "Walnut", dimensions: '36" × 72"' } as const;

  it("hero variant keeps grounding + framing phrases", () => {
    const p = buildRenderPrompt({ ...base, variant: "hero" });
    expect(p.variant).toBe("hero");
    expect(p.prompt).toContain("standing directly on the floor");
    expect(p.prompt).toContain("product-focused camera distance");
  });

  it("joinery variant emphasizes baguettes, screw-free interlocking, close-up", () => {
    const p = buildRenderPrompt({ ...base, variant: "joinery" });
    expect(p.variant).toBe("joinery");
    expect(p.prompt).toMatch(/baguette/i);
    expect(p.prompt).toMatch(/back panel/i);
    expect(p.prompt).toMatch(/side panel/i);
    expect(p.prompt).toMatch(/macro|close-up/i);
    expect(p.prompt).toMatch(/screw[- ]?free|no screws|NOT by screws/i);
    expect(p.negativePrompt).toMatch(/screws/i);
  });

  it("assembly variant produces an exploded/diagram composition", () => {
    const p = buildRenderPrompt({ ...base, variant: "assembly" });
    expect(p.variant).toBe("assembly");
    expect(p.prompt).toMatch(/exploded|assembly/i);
    expect(p.prompt).toMatch(/board/i);
    expect(p.prompt).toMatch(/module/i);
    expect(p.prompt).toMatch(/baguette/i);
    expect(p.negativePrompt).toMatch(/photograph|room/i);
  });

  it("defaults to hero when no variant given", () => {
    const p = buildRenderPrompt(base);
    expect(p.variant).toBe("hero");
  });
});

