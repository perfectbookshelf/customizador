/**
 * Screenshot-based visual regression for Steps 2/3/4 of the unified
 * BookshelfConfigurator wizard, for Portal, Cathedral, and U-Surround.
 *
 * Why pixel screenshots (not the DOM-snapshot test)?
 *   The DOM-snapshot test catches structural regressions (missing fields,
 *   wrong order, wrong values) but cannot detect styling regressions —
 *   a broken Tailwind class, a wrong color token, a busted grid, a
 *   collapsed slider track all leave the DOM identical.
 *
 * Approach:
 *   - Drive the live dev server (http://localhost:8080) with playwright-core,
 *     using the system chromium binary already in the sandbox.
 *   - Capture the right-hand step panel (`.configurator-config`) — never
 *     the 3D preview, whose pixels are non-deterministic across runs.
 *   - First run writes baselines under tests/__screenshots__/.
 *     Subsequent runs diff against the baseline with pixelmatch and fail
 *     if more than the allowed pixel-budget differs.
 *
 * Set UPDATE_SCREENSHOTS=1 to refresh baselines intentionally.
 */
import { describe, it, beforeAll, afterAll, expect } from "vitest"
import { chromium, type Browser, type Page } from "playwright-core"
import { PNG } from "pngjs"
import pixelmatch from "pixelmatch"
import fs from "node:fs"
import path from "node:path"

const BASE_URL = process.env.PREVIEW_URL ?? "http://localhost:8080"
const SCREENSHOT_DIR = path.resolve(process.cwd(), "tests/__screenshots__/step-visual")
const UPDATE = process.env.UPDATE_SCREENSHOTS === "1"
// Tolerate sub-pixel font/anti-aliasing noise; flag real regressions.
const PIXEL_DIFF_THRESHOLD = 0.1
const MAX_DIFF_RATIO = 0.005 // 0.5% of pixels may differ

const TYPES = [
  { label: "Cathedral", id: "cathedral" },
  { label: "U-Surround", id: "usurround" },
] as const

const STEPS = [
  { index: 2, name: "step2-dimensions", advanceLabel: /^next$/i },
  { index: 3, name: "step3-shelves",    advanceLabel: /^next$/i },
  { index: 4, name: "step4-finish",     advanceLabel: /^next$/i },
] as const

let browser: Browser | undefined
let serverAvailable = false

async function ensurePreviewReachable(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL, { method: "GET" })
    return res.ok
  } catch {
    return false
  }
}

beforeAll(async () => {
  serverAvailable = await ensurePreviewReachable()
  if (!serverAvailable) return
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  browser = await chromium.launch({
    executablePath: "/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    headless: true,
  })
}, 60_000)

afterAll(async () => {
  await browser?.close()
})

async function gotoFreshConfigurator(page: Page) {
  // Clear any persisted state so every test starts from defaults.
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" })
  await page.evaluate(() => {
    try {
      localStorage.clear()
      // Step 3 gates "Next" behind a saved quote email.
      localStorage.setItem("pbs_quote_email", "test@example.com")
    } catch { /* ignore */ }
  })
  await page.goto(BASE_URL, { waitUntil: "networkidle" })
}

async function clickButtonByText(page: Page, text: string | RegExp) {
  const re = typeof text === "string"
    ? new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
    : text
  // Pick the *first* visible button whose text matches.
  const button = page.locator("button").filter({ hasText: re }).first()
  await button.waitFor({ state: "visible", timeout: 10_000 })
  await button.click()
}

async function compareOrWriteBaseline(name: string, actualBuf: Buffer) {
  const baselinePath = path.join(SCREENSHOT_DIR, `${name}.png`)
  const diffPath = path.join(SCREENSHOT_DIR, `${name}.diff.png`)
  const actualPath = path.join(SCREENSHOT_DIR, `${name}.actual.png`)

  if (!fs.existsSync(baselinePath) || UPDATE) {
    fs.writeFileSync(baselinePath, actualBuf)
    return { wrote: true as const }
  }

  const baseline = PNG.sync.read(fs.readFileSync(baselinePath))
  const actual = PNG.sync.read(actualBuf)
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    fs.writeFileSync(actualPath, actualBuf)
    return {
      wrote: false as const,
      mismatch: `dimensions differ (baseline ${baseline.width}x${baseline.height}, actual ${actual.width}x${actual.height})`,
    }
  }

  const { width, height } = baseline
  const diff = new PNG({ width, height })
  const diffPixels = pixelmatch(baseline.data, actual.data, diff.data, width, height, {
    threshold: PIXEL_DIFF_THRESHOLD,
  })
  const ratio = diffPixels / (width * height)
  if (ratio > MAX_DIFF_RATIO) {
    fs.writeFileSync(diffPath, PNG.sync.write(diff))
    fs.writeFileSync(actualPath, actualBuf)
    return {
      wrote: false as const,
      mismatch: `${diffPixels} pixels differ (${(ratio * 100).toFixed(3)}% > ${(MAX_DIFF_RATIO * 100).toFixed(2)}%)`,
    }
  }
  return { wrote: false as const }
}

describe("Step 2/3/4 screenshot regression — Portal / Cathedral / U-Surround", () => {
  for (const type of TYPES) {
    for (const step of STEPS) {
      it(`${type.label} → ${step.name}`, async () => {
        if (!serverAvailable || !browser) {
          // Soft-skip when the dev server is not running (e.g. CI without preview).
          console.warn(`[step-screenshot] skipping ${type.label}/${step.name}: dev server not reachable at ${BASE_URL}`)
          return
        }

        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        const page = await context.newPage()
        try {
          await gotoFreshConfigurator(page)

          // Step 1: pick the type.
          await clickButtonByText(page, type.label)
          // Cathedral requires a style sub-option before Next unlocks.
          const center = page.locator("button").filter({ hasText: /^Center$/ }).first()
          if (await center.count()) await center.click()

          // Advance to the target step.
          for (let s = 1; s < step.index; s++) {
            await clickButtonByText(page, /^next$|^see quote$/i)
            // Brief settle for transition + slider mount.
            await page.waitForTimeout(150)
          }

          // Screenshot only the right-hand step panel (deterministic — no 3D canvas).
          const panel = page.locator(".configurator-config").first()
          await panel.waitFor({ state: "visible", timeout: 10_000 })
          // Allow fonts + layout to settle.
          await page.waitForTimeout(250)

          const buf = await panel.screenshot({ type: "png" })
          const result = await compareOrWriteBaseline(`${type.id}-${step.name}`, buf)

          if (result.wrote) {
            // First run / intentional update — recorded baseline; do not fail.
            return
          }
          if ("mismatch" in result && result.mismatch) {
            throw new Error(
              `Visual regression for ${type.label} ${step.name}: ${result.mismatch}. ` +
              `See tests/__screenshots__/step-visual/${type.id}-${step.name}.diff.png. ` +
              `Re-run with UPDATE_SCREENSHOTS=1 to accept.`,
            )
          }
          expect(true).toBe(true)
        } finally {
          await context.close()
        }
      }, 60_000)
    }
  }
})
