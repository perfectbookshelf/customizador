/**
 * Static guard: BookshelfConfigurator must never JSX-render the legacy
 * PortalConfigurator / CathedralConfigurator / USurroundConfigurator
 * components on any step. The unified WizardShell handles all types.
 *
 * Run with: bun test
 */
import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const SRC = readFileSync(
  join(import.meta.dir, "..", "BookshelfConfigurator.tsx"),
  "utf8",
)

const LEGACY = ["PortalConfigurator", "CathedralConfigurator", "USurroundConfigurator"] as const

describe("BookshelfConfigurator — no legacy delegation", () => {
  for (const name of LEGACY) {
    it(`never renders <${name} /> as JSX`, () => {
      // Match any JSX use: <Name ...> or <Name/> or <Name>
      const jsxRe = new RegExp(`<\\s*${name}[\\s/>]`)
      expect(jsxRe.test(SRC)).toBe(false)
    })

    it(`does not import ${name}`, () => {
      const importRe = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from`)
      expect(importRe.test(SRC)).toBe(false)
    })
  }
})
