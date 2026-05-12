import * as React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import { Plus, Minus, ShoppingCart, DoorOpen, Monitor, Flame, HelpCircle, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import iconHorizontal from "@/assets/icons/Horizontal.png"
import iconBookshelf from "@/assets/icons/Vertical_Bookshelf.png"
import iconCorner from "@/assets/icons/Corner.png"
import iconPortal from "@/assets/icons/Portal.png"
import iconCathedral from "@/assets/icons/Cathedral.png"
import iconUModel from "@/assets/icons/U-Model.png"
import type { BookshelfConfig, ShelfConfig, BookshelfType, BookshelfResult } from "@/lib/types"
import { calculateBookshelf } from "@/lib/bookshelf-calculator"
import type { Bookshelf3DViewRef } from "./Bookshelf3DView"
import { FloatingPreview } from "./FloatingPreview"
import { createShopifyCheckout } from "@/lib/shopify-checkout"
import { CouponField, type AppliedDiscount } from "./CouponField"
import { WizardShell, SwatchGrid, Swatch, type WizardStep } from "./wizard/WizardShell"
import { toast } from "sonner"

// Lazy-load heavy 3D views (three.js + @react-three/fiber + drei) so the
// initial wizard bundle stays light. Quality is unchanged — same components,
// just code-split out of the first paint.
const Bookshelf3DView = React.lazy(() =>
  import("./Bookshelf3DView").then((m) => ({ default: m.Bookshelf3DView }))
)
const Portal3DView = React.lazy(() =>
  import("./Portal3DView").then((m) => ({ default: m.Portal3DView }))
)
const Cathedral3DView = React.lazy(() =>
  import("./Cathedral3DView").then((m) => ({ default: m.Cathedral3DView }))
)
const USurround3DView = React.lazy(() =>
  import("./USurround3DView").then((m) => ({ default: m.USurround3DView }))
)

const Preview3DFallback = () => (
  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs tracking-[0.25em] uppercase">
    Loading preview…
  </div>
)

import { PortalSchematic } from "./PortalSchematic"
import { CathedralSchematic } from "./CathedralSchematic"
import { USurroundSchematic } from "./USurroundSchematic"
import { computeCathedralRows, calculateCathedral } from "@/lib/cathedral-calculator"
import { calculateUSurround } from "@/lib/usurround-calculator"
import { cn } from "@/lib/utils"

type MainType = "rack" | "bookshelf" | "corner" | "portal" | "cathedral" | "usurround"
export type CornerVariant = "outside" | "inside"

const TYPE_OPTIONS: {
  id: MainType
  label: string
  icon: string
  description: string
}[] = [
  { id: "bookshelf", label: "Bookshelf", icon: iconBookshelf, description: "Our flagship vertical shelf — the canvas for everything from a paperback library to a sculptural display wall." },
  { id: "rack", label: "Horizontal", icon: iconHorizontal, description: "A low, wide rack that doubles as a sideboard, media console, or window-line display." },
  { id: "corner", label: "Corner", icon: iconCorner, description: "Two arms that meet in the corner of a room. Choose inside or outside corner on the next step." },
  { id: "usurround", label: "U-Surround", icon: iconUModel, description: "Three-walled built-in that wraps a nook, reading bench, or doorway into a single composition." },
  { id: "cathedral", label: "Cathedral", icon: iconCathedral, description: "Sloped, vaulted shelving that follows the line of a pitched roof or stairwell." },
  { id: "portal", label: "Portal", icon: iconPortal, description: "Built-ins framed around a door, window, TV or fireplace — your shelves, custom-fit around the architecture." },
]

const FINISH_OPTIONS = [
  { id: "Oak/Oak", label: "White Oak", price: 68.15, color1: "#D4A574", color2: "#D4A574", comingSoon: false,
    description: "Quartersawn white oak. Open grain, honey tone, ages beautifully.",
  },
  { id: "Maple/Maple", label: "Maple", price: 49.21, color1: "#E8D4B8", color2: "#E8D4B8", comingSoon: false,
    description: "Pale, warm grain with a soft golden undertone. Reads modern and bright.",
  },
  { id: "Oak/White", label: "White Oak / White", price: 60.18, color1: "#D4A574", color2: "#f5f5f5", comingSoon: false,
    description: "White oak fronts with a clean white interior — graphic, gallery-like contrast.",
  },
  { id: "Maple/Black", label: "Maple / Black", price: 65.1, color1: "#E8D4B8", color2: "#1a1a1a", comingSoon: false, texture2: "/images/finishes/valchromat.png",
    description: "Maple fronts with deep matte-black Valchromat interiors. Theatrical and high-contrast.",
  },
  { id: "Oak/Black", label: "White Oak / Black", price: 77.99, color1: "#D4A574", color2: "#1a1a1a", comingSoon: false, texture2: "/images/finishes/valchromat.png",
    description: "White oak fronts with matte-black interiors. Quietly dramatic.",
  },
  { id: "Walnut/Walnut", label: "Walnut", price: 78.2, color1: "#5D432C", color2: "#5D432C", comingSoon: false,
    description: "Rich American walnut — chocolate brown with violet undertones. The signature.",
  },
  { id: "Black/Black", label: "Black", price: 54.59, color1: "#1a1a1a", color2: "#1a1a1a", comingSoon: true },
  { id: "White/White", label: "White", price: 41.6, color1: "#f5f5f5", color2: "#f5f5f5", comingSoon: true },
]

function toFraction(decimal: number): string {
  const whole = Math.floor(decimal)
  const fraction = decimal - whole
  const eighths = Math.round(fraction * 8)
  if (eighths === 0) return `${whole}"`
  if (eighths === 8) return `${whole + 1}"`
  const map: Record<number, string> = { 1: "1/8", 2: "1/4", 3: "3/8", 4: "1/2", 5: "5/8", 6: "3/4", 7: "7/8" }
  return `${whole} ${map[eighths]}"`
}

function toFeetAndInches(inches: number): string {
  const feet = Math.floor(inches / 12)
  const remainingInches = inches % 12
  if (feet === 0) return toFraction(remainingInches)
  if (remainingInches === 0) return `${feet}'`
  return `${feet}' ${toFraction(remainingInches)}`
}

function calculateTotalHeight(shelves: ShelfConfig[]): number {
  const sumOfSides = shelves.reduce((sum, shelf) => sum + shelf.height, 0)
  const depthGroups = new Set(shelves.map((s) => s.depth))
  const numberOfSets = depthGroups.size
  const numberOfShelves = shelves.length
  const additionalHeight = 0.75 * (numberOfShelves + numberOfSets)
  let transitions = 0
  for (let i = 1; i < shelves.length; i++) {
    if (shelves[i].depth < shelves[i - 1].depth) transitions++
  }
  return sumOfSides + additionalHeight + 0.75 * transitions
}

function enforceDepthConstraints(shelves: ShelfConfig[], changedIndex: number): ShelfConfig[] {
  const result = shelves.map(s => ({ ...s }))
  const newDepth = result[changedIndex].depth
  for (let i = changedIndex - 1; i >= 0; i--) {
    if (result[i].depth < newDepth) result[i].depth = newDepth
  }
  for (let i = changedIndex + 1; i < result.length; i++) {
    if (result[i].depth > newDepth) result[i].depth = newDepth
  }
  return result
}

function getAvailableDepths(shelves: ShelfConfig[], index: number): number[] {
  const maxAllowed = index > 0 ? shelves[index - 1].depth : 14
  return [7, 10, 14].filter(d => d <= maxAllowed)
}

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export function BookshelfConfigurator() {
  const defaultWidth = 69.75

  const [stepIndex, setStepIndex] = useState(0)
  const [quoteEmail, setQuoteEmail] = useState<string>("")
  // RFC-5322-lite: good enough for client-side gating without false negatives.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isValidQuoteEmail = EMAIL_RE.test(quoteEmail.trim()) && quoteEmail.trim().length <= 255
  const emailInputRef = useRef<HTMLInputElement>(null)
  const [emailFlash, setEmailFlash] = useState(false)
  const flashEmailField = () => {
    emailInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    emailInputRef.current?.focus({ preventScroll: true })
    setEmailFlash(true)
    window.setTimeout(() => setEmailFlash(false), 1600)
    toast.error("Enter your email to see your quote", {
      description: "We use it to send your quote and follow up on your build.",
    })
  }
  const saved = useMemo<any>(() => {
    const raw = safeGetItem("bookshelf-config")
    if (!raw) return {}
    try { return JSON.parse(raw) || {} } catch { return {} }
  }, [])

  const [mainType, setMainType] = useState<MainType>(saved.mainType ?? "bookshelf")
  const isLegacyType = mainType === "portal" || mainType === "cathedral" || mainType === "usurround"
  const [cornerVariant, setCornerVariant] = useState<CornerVariant>(saved.cornerVariant ?? "outside")
  const [width, setWidth] = useState<number>(saved.width ?? defaultWidth)
  const [width2, setWidth2] = useState<number>(saved.width2 ?? 50)
  const [selectedFinish, setSelectedFinish] = useState<string>(saved.selectedFinish ?? "Oak/Oak")
  const [shelves, setShelves] = useState<ShelfConfig[]>(saved.shelves ?? [
    { height: 14, depth: 14 }, { height: 14, depth: 14 },
    { height: 14, depth: 14 }, { height: 14, depth: 14 },
  ])
  const [shelves2, setShelves2] = useState<ShelfConfig[]>(saved.shelves2 ?? [
    { height: 14, depth: 14 }, { height: 14, depth: 14 },
    { height: 14, depth: 14 }, { height: 14, depth: 14 },
  ])

  // U-Surround widths (left arm / front / right arm)
  const [uW1, setUW1] = useState<number>(saved.uW1 ?? 50)
  const [uW, setUW] = useState<number>(saved.uW ?? 70)
  const [uW2, setUW2] = useState<number>(saved.uW2 ?? 50)

  // Cathedral dims (W width, H low height, H1 high height, slope direction)
  const [cathW, setCathW] = useState<number>(saved.cathW ?? 100)
  const [cathH, setCathH] = useState<number>(saved.cathH ?? 60)
  const [cathH1, setCathH1] = useState<number>(saved.cathH1 ?? 96)
  const [cathDir, setCathDir] = useState<"left" | "right" | "both">(saved.cathDir ?? "left")

  // Portal dims
  type PortalObject = "door" | "window" | "tv" | "fireplace" | "other"
  const savedPortalObjType = (saved.portalObjType ?? "door") as PortalObject
  const savedPortalWallH = savedPortalObjType === "door" && (saved.portalWallH ?? 108) <= 60 && (saved.portalObjH ?? 82) <= 48
    ? 108
    : saved.portalWallH ?? 108
  const savedPortalObjH = savedPortalObjType === "door" && (saved.portalWallH ?? 108) <= 60 && (saved.portalObjH ?? 82) <= 48
    ? 82
    : saved.portalObjH ?? 82
  const [portalWallW, setPortalWallW] = useState<number>(saved.portalWallW ?? 100)
  const [portalWallH, setPortalWallH] = useState<number>(savedPortalWallH)
  const [portalObjW, setPortalObjW] = useState<number>(saved.portalObjW ?? 36)
  const [portalObjH, setPortalObjH] = useState<number>(savedPortalObjH)
  const [portalFloorToObj, setPortalFloorToObj] = useState<number>(saved.portalFloorToObj ?? 0)
  const [portalRightGap, setPortalRightGap] = useState<number>(saved.portalRightGap ?? 32)
  const [portalObjType, setPortalObjType] = useState<PortalObject>(savedPortalObjType)


  // Keep portal object dims inside the wall whenever the wall shrinks.
  useEffect(() => {
    setPortalObjW(w => Math.min(w, Math.max(12, portalWallW - 14)))
    setPortalRightGap(g => Math.min(g, Math.max(0, portalWallW - Math.min(portalObjW, portalWallW - 14))))
  }, [portalWallW]) // eslint-disable-line react-hooks/exhaustive-deps
  // Doors must sit on the floor — never let saved/in-flight state lift them.
  useEffect(() => {
    if (portalObjType === "door" && portalFloorToObj !== 0) setPortalFloorToObj(0)
  }, [portalObjType, portalFloorToObj])

  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null)
  const bookshelf3DRef = useRef<Bookshelf3DViewRef>(null)
  const mainPreviewRef = useRef<HTMLDivElement>(null)
  const [isMobileDevice, setIsMobileDevice] = useState(false)

  // ─── Portal debug / scenario runner ───
  const [portalDebug, setPortalDebug] = useState(false)
  const [scenarioIdx, setScenarioIdx] = useState<number | null>(null)
  type PortalScenario = {
    name: string
    desc: string
    apply: () => void
    expect: string
  }
  const portalScenarios: PortalScenario[] = useMemo(() => [
    {
      name: "Baseline door",
      desc: "100w × 108h wall, 36×82 door on floor, 6 shelves",
      expect: "Frame hugs the door zone. No phantom top board crossing the door.",
      apply: () => {
        setPortalWallW(100); setPortalWallH(108)
        setPortalObjType("door"); setPortalObjW(36); setPortalObjH(82); setPortalFloorToObj(0)
        setPortalRightGap(32)
        setShelves(Array(6).fill(null).map(() => ({ height: 14, depth: 14 })))
      },
    },
    {
      name: "Tall wall, few shelves (PHANTOM TOP BOARD BUG)",
      desc: "108h wall but only 2 shelves → shelvesTop ≈ 30\", lastTop forced to 107.25\"",
      expect: "Debug overlay should warn: ⚠ phantom top board, top board mode = full.",
      apply: () => {
        setPortalWallW(100); setPortalWallH(108)
        setPortalObjType("door"); setPortalObjW(36); setPortalObjH(82); setPortalFloorToObj(0)
        setPortalRightGap(32)
        setShelves(Array(2).fill(null).map(() => ({ height: 14, depth: 14 })))
      },
    },
    {
      name: "Shelves exceed wall (clipping)",
      desc: "Wall=60\", 8 shelves of 14\" → 4–5 should clip out",
      expect: "Debug shows 'shelves rendered: X/8' with ⚠ clipped count.",
      apply: () => {
        setPortalWallH(60); setPortalWallW(100)
        setPortalObjType("door"); setPortalObjW(28); setPortalObjH(58); setPortalFloorToObj(0)
        setPortalRightGap(36)
        setShelves(Array(8).fill(null).map(() => ({ height: 14, depth: 14 })))
      },
    },
    {
      name: "Window lifted off floor",
      desc: "Window 36×48 at floorToObj=36, wall 108h",
      expect: "Floor board spans full width (no door zone). floor→obj = 36.00\".",
      apply: () => {
        setPortalObjType("window"); setPortalObjW(36); setPortalObjH(48); setPortalFloorToObj(36)
        setPortalWallW(100); setPortalWallH(108); setPortalRightGap(32)
        setShelves(Array(6).fill(null).map(() => ({ height: 14, depth: 14 })))
      },
    },
    {
      name: "Object pushed against wall ceiling",
      desc: "TV 55×31 at floorToObj=75 → top of object = 106\", wallH=108",
      expect: "lastTop ≈ shelvesTop, top board mode should be 'split' or 'none', no phantom warning.",
      apply: () => {
        setPortalObjType("tv"); setPortalObjW(55); setPortalObjH(31); setPortalFloorToObj(75)
        setPortalWallW(100); setPortalWallH(108); setPortalRightGap(22)
        setShelves(Array(7).fill(null).map(() => ({ height: 14, depth: 14 })))
      },
    },
  ], [])
  const runScenario = (i: number) => {
    setPortalDebug(true)
    setScenarioIdx(i)
    portalScenarios[i].apply()
  }

  const bookshelfType: BookshelfType =
    (mainType === "portal" || mainType === "cathedral" || mainType === "usurround") ? "bookshelf" : mainType

  // Reset shelf count when user changes type (skip the very first mount so saved state survives)
  const didMountTypeRef = useRef(false)
  useEffect(() => {
    if (!didMountTypeRef.current) { didMountTypeRef.current = true; return }
    const defaults: Record<MainType, number> = { rack: 2, bookshelf: 4, corner: 4, portal: 6, cathedral: 5, usurround: 4 }
    const count = defaults[mainType]
    setShelves(prev => prev.length === count ? prev : Array(count).fill(null).map(() => ({ height: 14, depth: 14 })))
    setShelves2(prev => prev.length === count ? prev : Array(count).fill(null).map(() => ({ height: 14, depth: 14 })))
    if (mainType === "portal") {
      // Seed portal so the bookshelf wraps OVER the door by default
      setPortalWallW(100); setPortalWallH(108)
      setPortalObjType("door"); setPortalObjW(36); setPortalObjH(82); setPortalFloorToObj(0)
      setPortalRightGap(32)
    }
  }, [mainType])

  useEffect(() => {
    safeSetItem("bookshelf-config", JSON.stringify({
      mainType, cornerVariant, width, width2, selectedFinish, shelves, shelves2,
      uW1, uW, uW2,
      cathW, cathH, cathH1, cathDir,
      portalWallW, portalWallH, portalObjW, portalObjH, portalFloorToObj, portalRightGap, portalObjType,
    }))
    setCheckoutError(null)
  }, [mainType, cornerVariant, width, width2, selectedFinish, shelves, shelves2,
      uW1, uW, uW2, cathW, cathH, cathH1, cathDir,
      portalWallW, portalWallH, portalObjW, portalObjH, portalFloorToObj, portalRightGap, portalObjType])

  useEffect(() => {
    const check = () => setIsMobileDevice(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const totalHeight = calculateTotalHeight(shelves)
  const maxShelfDepth = Math.max(
    ...shelves.map(s => s.depth),
    ...(mainType === "corner" ? shelves2.map(s => s.depth) : []),
  )

  const { result, totalPrice, totalArea } = useMemo(() => {
    try {
      const isInsideCorner = mainType === "corner" && cornerVariant === "inside"
      const config: BookshelfConfig = {
        type: isInsideCorner ? "bookshelf" : bookshelfType,
        totalWidth: width, shelves, finish: selectedFinish,
        width2: mainType === "corner" && !isInsideCorner ? width2 : undefined,
        shelves2: mainType === "corner" && !isInsideCorner ? shelves2 : undefined,
      }

      let calcResult: BookshelfResult
      if (isInsideCorner) {
        const arm1 = calculateBookshelf({ type: "bookshelf", totalWidth: width, shelves, finish: selectedFinish })
        const arm2 = calculateBookshelf({ type: "bookshelf", totalWidth: width2, shelves: shelves2, finish: selectedFinish })
        const skuMap = new Map<string, { type: string; quantity: number }>()
        for (const sku of [...arm1.allSkus, ...arm2.allSkus]) {
          const existing = skuMap.get(sku.name)
          if (existing) existing.quantity += sku.totalQuantity
          else skuMap.set(sku.name, { type: sku.type, quantity: sku.totalQuantity })
        }
        const allSkus = Array.from(skuMap.entries())
          .map(([name, data]) => ({ name, type: data.type, totalQuantity: data.quantity }))
          .sort((a, b) => a.type.localeCompare(b.type))
        calcResult = {
          config,
          totalHeight: arm1.totalHeight,
          totalModules: arm1.totalModules + arm2.totalModules,
          boards: [...arm1.boards, ...arm2.boards],
          shelves: [...arm1.shelves, ...arm2.shelves],
          allSkus,
        }
      } else {
        calcResult = calculateBookshelf(config)
      }

      const finishOption = FINISH_OPTIONS.find((f) => f.id === selectedFinish)
      let areaInSqFt: number
      if (mainType === "corner") {
        if (cornerVariant === "inside") {
          areaInSqFt = (totalHeight * width + totalHeight * width2) / 144
        } else {
          areaInSqFt = (totalHeight * width + totalHeight * width2 - totalHeight * maxShelfDepth) / 144
        }
      } else {
        areaInSqFt = (totalHeight * width) / 144
      }
      const price = areaInSqFt * (finishOption?.price || 0)
      return { result: calcResult, totalPrice: price, totalArea: areaInSqFt }
    } catch {
      return { result: null, totalPrice: 0, totalArea: 0 }
    }
  }, [bookshelfType, width, width2, shelves, shelves2, selectedFinish, totalHeight, mainType, maxShelfDepth, cornerVariant])

  const corner3DModules = useMemo(() => {
    if (mainType !== "corner") return { arm1: undefined, arm2: undefined }
    try {
      const arm1 = calculateBookshelf({ type: "bookshelf", totalWidth: width, shelves, finish: selectedFinish })
      const arm2 = calculateBookshelf({ type: "bookshelf", totalWidth: width2, shelves: shelves2, finish: selectedFinish })
      return { arm1: arm1.shelves.map((s) => s.modules), arm2: arm2.shelves.map((s) => s.modules) }
    } catch { return { arm1: undefined, arm2: undefined } }
  }, [mainType, width, width2, shelves, shelves2, selectedFinish])

  const addShelf = () => {
    if (shelves.length < 8) {
      const topDepth = shelves[shelves.length - 1]?.depth || 14
      const newShelf: ShelfConfig = { height: 14, depth: topDepth }
      setShelves([...shelves, newShelf])
      setShelves2([...shelves, newShelf].map(s => ({ ...s })))
    }
  }
  const removeShelf = () => {
    if (shelves.length > 1) {
      const newShelves = shelves.slice(0, -1)
      setShelves(newShelves)
      setShelves2(newShelves.map(s => ({ ...s })))
    }
  }
  const updateShelf = (index: number, field: "height" | "depth", value: number) => {
    const newShelves = [...shelves]
    newShelves[index] = { ...newShelves[index], [field]: value }
    const finalShelves = field === "depth" ? enforceDepthConstraints(newShelves, index) : newShelves
    setShelves(finalShelves)
    setShelves2(finalShelves.map(s => ({ ...s })))
  }

  async function handleAddToCart() {
    if (!result) return
    setIsAddingToCart(true)
    const finishOption = FINISH_OPTIONS.find((f) => f.id === selectedFinish)
    const finishLabel = finishOption?.label || selectedFinish
    let imageDataUrl: string | null = null
    try { if (bookshelf3DRef.current) imageDataUrl = await bookshelf3DRef.current.captureImage() } catch { /* */ }

    const config = {
      bookshelfType,
      finish: finishLabel,
      totalArea: totalArea.toFixed(2),
      pricePerSqFt: finishOption?.price.toFixed(2) || "0.00",
      totalDimensions: `${toFraction(width)} x ${toFraction(totalHeight)}`,
      dimensions: { width, ...(mainType === "corner" ? { width2 } : {}), height: totalHeight },
      shelves,
      ...(mainType === "corner" ? { shelves2 } : {}),
      skus: result.allSkus,
    }

    try {
      const checkoutUrl = await createShopifyCheckout({ price: totalPrice.toFixed(2), config, imageDataUrl, discountCode: appliedDiscount?.code })
      const _pbsSet = (key: string, value: string) => {
        try { localStorage.setItem(key, value) } catch { /* ignore */ }
        if (window.self !== window.top) window.parent.postMessage({ type: "pbs-storage-set", key, value }, "*")
      }
      _pbsSet("pbs_checkout_url", checkoutUrl)
      if (imageDataUrl) _pbsSet("pbs_cart_image", imageDataUrl)

      const inIframe = window.self !== window.top
      if (inIframe) {
        try {
          window.parent.postMessage({ type: "pbs-ga4-event", eventName: "add_to_cart", params: { currency: "USD", value: totalPrice } }, "*")
          window.parent.postMessage({ type: "pbs-ga4-event", eventName: "begin_checkout", params: { currency: "USD", value: totalPrice } }, "*")
          window.parent.postMessage({ type: "pbs-checkout-redirect", checkoutUrl }, "*")
        } catch { /* ignore */ }
        // Try to break out of the iframe (works when same-origin); otherwise open in a new tab.
        try {
          if (window.top) window.top.location.href = checkoutUrl
          else throw new Error("no top")
        } catch {
          const w = window.open(checkoutUrl, "_blank", "noopener,noreferrer")
          if (!w) {
            // Popup blocked — last resort, navigate the iframe itself.
            window.location.href = checkoutUrl
          }
        }
      } else {
        window.location.href = checkoutUrl
      }
    } catch (err) {
      console.error("Checkout error:", err)
      setCheckoutError("Something went wrong. Please try again or contact us.")
    } finally {
      setIsAddingToCart(false)
    }
  }

  function handleReset() {
    // Wipe persisted state so a page reload also lands on the bookshelf default.
    try { localStorage.removeItem("bookshelf-config") } catch { /* ignore */ }
    setStepIndex(0)
    setMainType("bookshelf")
    setCornerVariant("outside")
    setWidth(defaultWidth)
    setWidth2(50)
    const defaultShelves: ShelfConfig[] = [
      { height: 14, depth: 14 }, { height: 14, depth: 14 },
      { height: 14, depth: 14 }, { height: 14, depth: 14 },
    ]
    setShelves(defaultShelves)
    setShelves2(defaultShelves.map(s => ({ ...s })))
    setSelectedFinish("Oak/Oak")
    // U-Surround defaults
    setUW1(50); setUW(70); setUW2(50)
    // Cathedral defaults
    setCathW(100); setCathH(60); setCathH1(96); setCathDir("left")
    // Portal defaults
    setPortalWallW(100); setPortalWallH(108)
    setPortalObjW(36); setPortalObjH(82)
    setPortalFloorToObj(0); setPortalRightGap(32)
    setPortalObjType("door")
    setQuoteEmail("")
  }

  // All types (including portal/cathedral/usurround) use the unified wizard layout.
  // Runtime guard: assert we never delegate to a legacy *Configurator from here.
  if (import.meta.env.DEV) {
    const LEGACY_TYPES = ["portal", "cathedral", "usurround"] as const
    const renderingLegacy = false // legacy Portal/Cathedral/USurround configurator delegation removed
    console.assert(
      !renderingLegacy,
      `[BookshelfConfigurator] Legacy configurator rendered for type=${mainType} step=${stepIndex}`,
    )
    if ((LEGACY_TYPES as readonly string[]).includes(mainType)) {
      console.debug(`[BookshelfConfigurator] type=${mainType} step=${stepIndex} → unified wizard (legacy delegation removed)`)
    }
  }

  const finishOption = FINISH_OPTIONS.find((f) => f.id === selectedFinish)
  const activeType = TYPE_OPTIONS.find(t => t.id === mainType)!

  /* ─── Step content ─── */

  const typeStep: WizardStep = {
    label: "Type",
    selectionName: activeType.label,
    priceDelta: "+ $0",
    description: activeType.description,
    content: (
      <div className="space-y-6">
        <SwatchGrid cols={3}>
          {TYPE_OPTIONS.map(t => (
            <Swatch key={t.id} label={t.label} selected={mainType === t.id} onClick={() => setMainType(t.id)}>
              <div className="absolute inset-0 flex items-center justify-center bg-secondary/40">
                <img src={t.icon} alt={t.label} className="h-12 w-12 object-contain" />
              </div>
            </Swatch>
          ))}
        </SwatchGrid>
        {mainType === "corner" && (
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
            {(["outside", "inside"] as const).map(v => (
              <button
                key={v}
                onClick={() => setCornerVariant(v)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 transition-all",
                  cornerVariant === v
                    ? "border border-brand-walnut text-foreground"
                    : "border border-border text-muted-foreground hover:border-foreground/40",
                )}
              >
                <span className="text-[11px] tracking-[0.2em] uppercase font-medium">{v === "outside" ? "Outside" : "Inside"} Corner</span>
              </button>
            ))}
          </div>
        )}
      </div>
    ),
  }

  const widthStepSelectionName = (() => {
    if (mainType === "corner") return `${toFraction(width)} × ${toFraction(width2)}`
    if (mainType === "usurround") return `${toFraction(uW1)} · ${toFraction(uW)} · ${toFraction(uW2)}`
    if (mainType === "cathedral") return `${toFraction(cathW)} × ${toFraction(cathH)}–${toFraction(cathH1)}`
    if (mainType === "portal") return `Wall ${toFraction(portalWallW)} × ${toFraction(portalWallH)}`
    return `${toFeetAndInches(width)} wide`
  })()

  const widthStepDelta = (() => {
    if (mainType === "cathedral") return `${toFraction(cathH1 - cathH)} slope`
    if (mainType === "portal") return `${portalObjType}`
    return `${toFraction(totalHeight)} tall`
  })()

  const widthStep: WizardStep = {
    label: "Dimensions",
    selectionName: widthStepSelectionName,
    priceDelta: widthStepDelta,
    description:
      mainType === "corner"
        ? "Set both arms of the corner. The 3D preview updates live — adjust until it fits your wall."
        : mainType === "usurround"
        ? "Three walls — left arm (W1), front (W), and right arm (W2). All share the same shelf layout."
        : mainType === "cathedral"
        ? "Set the wall width and the two heights — the low side (H) and the tall side (H1). Then pick the slope direction."
        : mainType === "portal"
        ? "Set the wall, then the object you're framing (door, window, TV, fireplace) and where it sits."
        : "Set the total width. Heights are determined by the shelves you add in the next step.",
    content:
      mainType === "usurround" ? (
        <USurroundDimsContent w1={uW1} setW1={setUW1} w={uW} setW={setUW} w2={uW2} setW2={setUW2} />
      ) : mainType === "cathedral" ? (
        <CathedralDimsContent
          W={cathW} setW={setCathW} H={cathH} setH={setCathH} H1={cathH1} setH1={setCathH1}
          direction={cathDir} setDirection={setCathDir}
        />
      ) : mainType === "portal" ? (
        <PortalDimsContent
          wallW={portalWallW} setWallW={setPortalWallW}
          wallH={portalWallH} setWallH={setPortalWallH}
          objW={portalObjW} setObjW={setPortalObjW}
          objH={portalObjH} setObjH={setPortalObjH}
          floorToObj={portalFloorToObj} setFloorToObj={setPortalFloorToObj}
          rightGap={portalRightGap} setRightGap={setPortalRightGap}
          objType={portalObjType} setObjType={setPortalObjType}
        />
      ) : (
        <div className="space-y-8">
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">{mainType === "corner" ? "Arm 1" : "Width"}</span>
              <span className="text-sm font-medium">{toFraction(width)}</span>
            </div>
            <Slider value={[width]} onValueChange={([v]) => setWidth(v)} min={25} max={200} step={0.25} />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2 tracking-widest">
              <span>25"</span><span>200"</span>
            </div>
          </div>
          {mainType === "corner" && (
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">Arm 2</span>
                <span className="text-sm font-medium">{toFraction(width2)}</span>
              </div>
              <Slider value={[width2]} onValueChange={([v]) => setWidth2(v)} min={25} max={200} step={0.25} />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-2 tracking-widest">
                <span>25"</span><span>200"</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 italic">
                {cornerVariant === "inside"
                  ? "Inside corner — backs meet flush, no overlap deduction."
                  : "Outside corner — overlap is automatically subtracted from materials and price."}
              </p>
            </div>
          )}
        </div>
      ),
  }

  // Cathedral tier rows (height per row is sliced by the slope ceiling).
  const cathedralRows = mainType === "cathedral"
    ? computeCathedralRows(cathW, cathH, cathH1, shelves, cathDir)
    : []
  const visibleCount = mainType === "cathedral" ? cathedralRows.length : shelves.length
  const cathedralStackHeight = mainType === "cathedral"
    ? cathedralRows.reduce((sum, r) => sum + r.shelves[0].height + 0.75, 0)
    : 0

  const shelvesStepLabel =
    mainType === "cathedral" ? "Tiers"
    : mainType === "usurround" ? "Shelves (all walls)"
    : "Shelves"
  const shelvesStepUnit =
    mainType === "cathedral" ? "tiers"
    : "shelves"
  const shelvesStepHeight =
    mainType === "cathedral" ? cathedralStackHeight : totalHeight
  const shelvesStepDescription =
    mainType === "cathedral"
      ? "Each tier sits across the full width available at its height. Higher tiers narrow automatically as the slope cuts in. Depth narrows as you go up."
      : mainType === "usurround"
      ? "Shelves are shared across all three walls (left, front, right). Each shelf has its own height and depth — depth narrows as you go up."
      : mainType === "portal"
      ? "Shelves run on both sides of the framed object. Each has its own height and depth — depth narrows as you go up."
      : "Each shelf has its own height and depth. Depth narrows as you go up — perfect for stepped, sculptural shelves."
  const typePrefix =
    mainType === "cathedral" ? "Cathedral · "
    : mainType === "portal" ? "Portal · "
    : mainType === "usurround" ? "U-Surround · "
    : ""
  const numberLabel =
    mainType === "cathedral" ? "Number of tiers" : "Number of shelves"

  const shelvesStep: WizardStep = {
    label: "Shelves",
    selectionName: `${typePrefix}${visibleCount} ${shelvesStepUnit}`,
    priceDelta: `${toFraction(shelvesStepHeight)} tall`,
    description: shelvesStepDescription,
    nextLabel: "See Quote",
    nextDisabled: !isValidQuoteEmail,
    onNextBlocked: flashEmailField,
    content: (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-y border-border py-4">
          <span className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">{numberLabel}</span>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={removeShelf} disabled={shelves.length <= 1}>
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-base font-display w-6 text-center">{shelves.length}</span>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={addShelf} disabled={shelves.length >= 8}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {mainType === "cathedral" && cathedralRows.length < shelves.length && (
          <div className="text-[10px] text-muted-foreground italic px-1 -mt-3">
            {shelves.length - cathedralRows.length} top tier{shelves.length - cathedralRows.length > 1 ? "s" : ""} hidden — wall slope leaves no room. Lower tier heights or raise the wall on Step 2.
          </div>
        )}
        <div className="space-y-1.5">
          {[...shelves].reverse().map((shelf, revIndex) => {
            const index = shelves.length - 1 - revIndex
            const transition = index > 0 && shelf.depth < shelves[index - 1].depth
            const tierRow = mainType === "cathedral" ? cathedralRows.find(r => r.rowIndex === index) : undefined
            const hiddenTier = mainType === "cathedral" && !tierRow
            const tierLabel = mainType === "cathedral" ? `Tier ${index + 1}` : `Shelf ${index + 1}`
            return (
              <div key={index}>
                <div className={cn(
                  "grid grid-cols-[auto_1fr_1fr] items-center gap-3 py-2 px-3 bg-secondary/40",
                  hiddenTier && "opacity-50"
                )}>
                  <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground w-14">{tierLabel}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tracking-widest uppercase text-muted-foreground">H</span>
                    <Select value={shelf.height.toString()} onValueChange={(v) => updateShelf(index, "height", Number.parseInt(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[12, 14].map((h) => (<SelectItem key={h} value={h.toString()}>{h}"</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tracking-widest uppercase text-muted-foreground">D</span>
                    <Select value={shelf.depth.toString()} onValueChange={(v) => updateShelf(index, "depth", Number.parseInt(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {getAvailableDepths(shelves, index).map((d) => (<SelectItem key={d} value={d.toString()}>{d}"</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {tierRow && (
                  <div className="text-[10px] text-muted-foreground pl-3 mt-0.5">
                    Width at this tier: {toFraction(tierRow.availableWidth)}
                  </div>
                )}
                {hiddenTier && (
                  <div className="text-[10px] text-muted-foreground italic pl-3 mt-0.5">
                    Hidden — above slope ceiling
                  </div>
                )}
                {transition && (
                  <div className="text-[10px] text-muted-foreground italic pl-3 mt-0.5">↓ Transition board added here</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Email gate — required to unlock pricing on Step 4 */}
        <div className="border-t border-border pt-6 mt-2 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">Your email</span>
            <span className="text-[10px] tracking-widest uppercase text-muted-foreground">Required</span>
          </div>
          <Input
            ref={emailInputRef}
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={255}
            placeholder="you@example.com"
            value={quoteEmail}
            onChange={(e) => setQuoteEmail(e.target.value)}
            aria-invalid={quoteEmail.length > 0 && !isValidQuoteEmail}
            className={cn(
              "h-10 transition-all",
              emailFlash && "ring-2 ring-destructive ring-offset-2 ring-offset-background border-destructive animate-pulse",
            )}
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            We&rsquo;ll use this to send your quote and follow up on your build. Enter a valid address to unlock pricing.
          </p>
          <Button
            onClick={() => isValidQuoteEmail ? setStepIndex(stepIndex + 1) : flashEmailField()}
            disabled={!isValidQuoteEmail}
            className="w-full h-11 mt-2 text-[11px] tracking-[0.25em] uppercase font-medium"
          >
            See Quote
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>
    ),
  }

  const finishStep: WizardStep = {
    label: "Finish",
    selectionName: finishOption?.label ?? "—",
    priceDelta: `$${totalPrice.toFixed(2)} · $${(finishOption?.price ?? 0).toFixed(2)}/sq ft`,
    description: finishOption?.description ?? "Choose your wood and color combination. The pair (front / interior) is shown on each swatch.",
    nextLabel: "Review",
    content: (
      <SwatchGrid cols={4}>
        {FINISH_OPTIONS.map(f => (
          <Swatch
            key={f.id}
            label={f.label.replace("/", " / ")}
            selected={selectedFinish === f.id}
            disabled={f.comingSoon}
            onClick={() => !f.comingSoon && setSelectedFinish(f.id)}
            badge={f.comingSoon ? "Sold out" : undefined}
          >
            {f.color1 !== f.color2 ? (
              <div className="absolute inset-0 flex">
                <div className="w-1/2 h-full" style={{ backgroundColor: f.color1 }} />
                <div
                  className="w-1/2 h-full"
                  style={f.texture2
                    ? { backgroundImage: `url(${f.texture2})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : { backgroundColor: f.color2 }}
                />
              </div>
            ) : (
              <div className="absolute inset-0" style={{ backgroundColor: f.color1 }} />
            )}
          </Swatch>
        ))}
      </SwatchGrid>
    ),
  }

  const reviewStep: WizardStep = {
    label: "Review",
    selectionName: `${activeType.label} · ${finishOption?.label ?? ""}`,
    priceDelta: `$${totalPrice.toFixed(2)}`,
    description: "Review the configuration below. We'll generate a draft order in Shopify and take you to checkout.",
    hideNav: true,
    content: (
      <div className="space-y-8">
        {isLegacyType && (
          <div className="border border-border p-4 bg-muted/20 flex items-center justify-center">
            {mainType === "portal" && (
              <PortalSchematic
                wallWidth={portalWallW}
                wallHeight={portalWallH}
                objectWidth={portalObjW}
                objectHeight={portalObjH}
                floorToObject={portalFloorToObj}
                rightGap={portalRightGap}
                leftGap={Math.max(0, portalWallW - portalObjW - portalRightGap)}
                topHeight={Math.max(0, portalWallH - portalFloorToObj - portalObjH)}
              />
            )}
            {mainType === "cathedral" && (
              <CathedralSchematic
                W={cathW} H={cathH} H1={cathH1} direction={cathDir}
                shelfYPositions={(() => {
                  const positions: number[] = []; let y = 0
                  for (const s of shelves) { y += s.height + 0.75; positions.push(y) }
                  return positions
                })()}
              />
            )}
            {mainType === "usurround" && (
              <USurroundSchematic w1={uW1} w={uW} w2={uW2} h={totalHeight} />
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <SummaryRow label="Type" value={activeType.label} />
          <SummaryRow label="Finish" value={finishOption?.label ?? "—"} />
          <SummaryRow
            label="Dimensions"
            value={mainType === "corner"
              ? `${toFraction(width)} × ${toFraction(width2)} × ${toFraction(totalHeight)}`
              : `${toFraction(width)} × ${toFraction(totalHeight)}`}
          />
          <SummaryRow label="Shelves" value={`${shelves.length}${mainType === "corner" ? ` + ${shelves2.length}` : ""}`} />
          <SummaryRow label="Area" value={`${totalArea.toFixed(2)} sq ft`} />
          <SummaryRow label="Rate" value={`$${(finishOption?.price ?? 0).toFixed(2)} / sq ft`} />
        </div>

        <div className="border-y border-border py-5 flex items-baseline justify-between">
          <span className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground">Total</span>
          <span className="text-3xl font-display tracking-tight">${totalPrice.toFixed(2)}</span>
        </div>

        <CouponField
          appliedDiscount={appliedDiscount}
          onApply={setAppliedDiscount}
          onRemove={() => setAppliedDiscount(null)}
        />

        {checkoutError && (
          <div className="text-sm text-destructive border border-destructive/30 p-3">
            {checkoutError}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            onClick={() => setStepIndex(stepIndex - 1)}
            className="text-[11px] tracking-[0.2em] font-medium uppercase text-foreground hover:text-brand-walnut"
          >
            ← Back
          </button>
          <Button
            onClick={handleAddToCart}
            disabled={isAddingToCart || !result}
            className="h-12 px-8 rounded-none gap-2 bg-foreground hover:bg-brand-walnut text-background tracking-[0.2em] uppercase text-[11px] font-semibold transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            {isAddingToCart ? "Processing…" : "Checkout"}
          </Button>
        </div>
      </div>
    ),
  }

  const steps: WizardStep[] = [typeStep, widthStep, shelvesStep, finishStep, reviewStep]

  /* ─── Preview ─── */

  const preview = (
    <div ref={mainPreviewRef} className="relative w-full h-full min-h-[45vh] lg:min-h-screen flex items-center justify-center">
      {/* Dimension badge */}
      {!isLegacyType && (
        <div className="absolute top-4 right-4 lg:top-8 lg:right-8 z-10 text-right pointer-events-none">
          <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground">Dimensions</div>
          <div className="text-sm font-medium text-foreground mt-1">
            {mainType === "corner"
              ? <>{toFraction(width)} × {toFraction(width2)} × {toFraction(totalHeight)}</>
              : <>{toFraction(width)} × {toFraction(totalHeight)}</>}
          </div>
        </div>
      )}
      {/* Portal debug + scenario runner */}
      {mainType === "portal" && (
        <div className="absolute bottom-4 right-4 z-20 max-w-[280px] bg-background/95 backdrop-blur border border-border rounded-md shadow-lg p-3 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Portal QA</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={portalDebug}
                onChange={(e) => setPortalDebug(e.target.checked)}
                className="accent-primary"
              />
              <span className="text-[10px]">Debug overlay</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-1">
            {portalScenarios.map((s, i) => (
              <button
                key={i}
                onClick={() => runScenario(i)}
                className={`text-[10px] px-2 py-1 rounded border ${scenarioIdx === i ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
                title={s.desc}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => {
                if (scenarioIdx === null) { runScenario(0); return }
                const next = (scenarioIdx + 1) % portalScenarios.length
                runScenario(next)
              }}
              className="text-[10px] px-2 py-1 rounded border border-border bg-background hover:bg-muted font-semibold"
            >
              Run checks ▶
            </button>
          </div>
          {scenarioIdx !== null && (
            <div className="space-y-1 border-t border-border pt-2">
              <div className="font-semibold text-[11px]">{scenarioIdx + 1}. {portalScenarios[scenarioIdx].name}</div>
              <div className="text-[10px] text-muted-foreground">{portalScenarios[scenarioIdx].desc}</div>
              <div className="text-[10px]"><span className="text-muted-foreground">Expect:</span> {portalScenarios[scenarioIdx].expect}</div>
              <div className="text-[10px] italic text-muted-foreground">📸 Capture a screenshot, then click ▶ for the next scenario.</div>
            </div>
          )}
        </div>
      )}
      <div className="absolute inset-0">
        <React.Suspense fallback={<Preview3DFallback />}>

        {mainType === "portal" ? (
          <PortalLivePreview
            finish={selectedFinish}
            wallWidth={portalWallW} wallHeight={portalWallH}
            objectWidth={portalObjW} objectHeight={portalObjH}
            floorToObject={portalFloorToObj} rightGap={portalRightGap}
            objectType={portalObjType}
            shelves={shelves}
            debug={portalDebug}
          />
        ) : mainType === "cathedral" ? (
          <CathedralLivePreview
            finish={selectedFinish}
            W={cathW} H={cathH} H1={cathH1} direction={cathDir}
            shelves={shelves}
          />
        ) : mainType === "usurround" ? (
          <USurroundLivePreview
            finish={selectedFinish}
            w1={uW1} w={uW} w2={uW2}
            shelves={shelves}
          />
        ) : result ? (
          <Bookshelf3DView
            ref={bookshelf3DRef}
            style={bookshelfType}
            width={width}
            width2={mainType === "corner" ? width2 : undefined}
            shelves={shelves}
            shelves2={mainType === "corner" ? shelves2 : undefined}
            finish={selectedFinish}
            modules={mainType === "corner" ? corner3DModules.arm1 : result.shelves.map((s) => s.modules)}
            modules2={mainType === "corner" ? corner3DModules.arm2 : undefined}
            cornerVariant={mainType === "corner" ? cornerVariant : undefined}
            isMobile={false}
            hideTooltip
            fillContainer
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">Configure to see preview</div>
        )}
        </React.Suspense>
      </div>
      {isMobileDevice && result && !isLegacyType && <FloatingPreview mainPreviewRef={mainPreviewRef} />}
    </div>
  )

  return (
    <WizardShell
      brand="PBS"
      preview={preview}
      steps={steps}
      index={stepIndex}
      onIndexChange={(next) => setStepIndex(next > 2 && !isValidQuoteEmail ? Math.min(2, next) : next)}
      onReset={handleReset}
    />
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground mt-1">{value}</span>
    </div>
  )
}

/* ─── Live 3D previews for Portal / Cathedral / U-Surround ─── */

function PortalLivePreview({ finish, wallWidth, wallHeight, objectWidth, objectHeight, floorToObject, rightGap, objectType, shelves, debug }: {
  finish: string
  wallWidth: number; wallHeight: number
  objectWidth: number; objectHeight: number
  floorToObject: number; rightGap: number
  objectType: "door" | "window" | "tv" | "fireplace" | "other"
  shelves: ShelfConfig[]
  debug?: boolean
}) {
  // Defensive clamp: state updates are async, so a wall-shrink can briefly
  // leave object dims oversized. Always render with values that fit the wall.
  const safeObjW = Math.max(0, Math.min(objectWidth, wallWidth))
  const safeObjH = Math.max(0, Math.min(objectHeight, wallHeight))
  const safeRightGap = Math.max(0, Math.min(rightGap, Math.max(0, wallWidth - safeObjW)))
  const safeFloorToObj = Math.max(0, Math.min(floorToObject, Math.max(0, wallHeight - safeObjH)))
  const leftGap = Math.max(0, wallWidth - safeObjW - safeRightGap)
  const topHeight = Math.max(0, wallHeight - safeFloorToObj - safeObjH)
  const sideRes = useMemo(() => {
    try { return calculateBookshelf({ type: "bookshelf", totalWidth: leftGap, shelves, finish }) } catch { return null }
  }, [leftGap, shelves, finish])
  const rightRes = useMemo(() => {
    try { return calculateBookshelf({ type: "bookshelf", totalWidth: safeRightGap, shelves, finish }) } catch { return null }
  }, [safeRightGap, shelves, finish])
  const topRes = useMemo(() => {
    try { return calculateBookshelf({ type: "bookshelf", totalWidth: safeObjW, shelves: [{ height: 14, depth: shelves[0]?.depth ?? 10 }], finish }) } catch { return null }
  }, [safeObjW, shelves, finish])
  return (
    <Portal3DView
      wallWidth={wallWidth} wallHeight={wallHeight}
      objectWidth={safeObjW} objectHeight={safeObjH}
      floorToObject={safeFloorToObj} rightGap={safeRightGap}
      leftGap={leftGap} topHeight={topHeight}
      objectType={objectType}
      shelves={shelves}
      leftModules={sideRes?.shelves.map(s => s.modules)}
      rightModules={rightRes?.shelves.map(s => s.modules)}
      topModules={topRes?.shelves.map(s => s.modules)}
      bottomModules={undefined}
      finish={finish} hideTooltip fillContainer
      debug={debug}
    />
  )
}

function CathedralLivePreview({ finish, W, H, H1, direction, shelves }: {
  finish: string; W: number; H: number; H1: number; direction: "left" | "right" | "both"; shelves: ShelfConfig[]
}) {
  const data = useMemo(() => {
    try { return calculateCathedral(W, H, H1, shelves, direction, finish) }
    catch { return { rows: [], modulesPerRow: [], totalArea: 0, allSkus: [] as any[] } }
  }, [W, H, H1, shelves, direction, finish])
  return (
    <Cathedral3DView
      W={W} H={H} H1={H1} direction={direction}
      rows={data.rows}
      modulesPerRow={data.modulesPerRow}
      finish={finish} hideTooltip fillContainer
    />
  )
}

function USurroundLivePreview({ finish, w1, w, w2, shelves }: {
  finish: string; w1: number; w: number; w2: number; shelves: ShelfConfig[]
}) {
  const data = useMemo(() => {
    try {
      const res = calculateUSurround({ w1, w, w2, shelvesLeft: shelves, shelvesFront: shelves, shelvesRight: shelves, finish })
      return {
        modulesLeft: res.leftResult.shelves.map((s: any) => s.modules),
        modulesFront: res.frontResult.shelves.map((s: any) => s.modules),
        modulesRight: res.rightResult.shelves.map((s: any) => s.modules),
      }
    } catch { return { modulesLeft: undefined, modulesFront: undefined, modulesRight: undefined } }
  }, [w1, w, w2, shelves, finish])
  return (
    <USurround3DView
      w1={w1} w={w} w2={w2}
      shelvesLeft={shelves} shelvesFront={shelves} shelvesRight={shelves}
      modulesLeft={data.modulesLeft} modulesFront={data.modulesFront} modulesRight={data.modulesRight}
      finish={finish} hideTooltip fillContainer
    />
  )
}

/* ─── Per-type Step 2 (Dimensions) sub-bodies ─── */

function LabeledSlider({ label, value, onChange, min, max, step = 0.25, hint }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; hint?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{toFraction(value)}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 tracking-widest">
        <span>{min}"</span><span>{max}"</span>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground mt-2 italic">{hint}</p>}
    </div>
  )
}

function USurroundDimsContent({ w1, setW1, w, setW, w2, setW2 }: {
  w1: number; setW1: (v: number) => void; w: number; setW: (v: number) => void; w2: number; setW2: (v: number) => void
}) {
  return (
    <div className="space-y-8">
      <LabeledSlider label="Left arm (W1)" value={w1} onChange={setW1} min={25} max={200} />
      <LabeledSlider label="Front (W)" value={w} onChange={setW} min={25} max={200} />
      <LabeledSlider label="Right arm (W2)" value={w2} onChange={setW2} min={25} max={200}
        hint="Deduct ~1” from each wall measurement to allow for wall imperfections." />
    </div>
  )
}

function CathedralDimsContent({ W, setW, H, setH, H1, setH1, direction, setDirection }: {
  W: number; setW: (v: number) => void; H: number; setH: (v: number) => void; H1: number; setH1: (v: number) => void
  direction: "left" | "right" | "both"; setDirection: (d: "left" | "right" | "both") => void
}) {
  const tooSmall = H1 - H < 14
  return (
    <div className="space-y-8">
      <LabeledSlider label="Width (W)" value={W} onChange={setW} min={25} max={240} />
      <LabeledSlider label="Low side (H)" value={H} onChange={setH} min={20} max={Math.max(20, H1 - 14)} />
      <LabeledSlider label="High side (H1)" value={H1} onChange={setH1} min={H + 14} max={120}
        hint={tooSmall ? "H1 must be at least 14” taller than H." : "Slope rises from H on one side to H1 on the other."} />
      <div>
        <span className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground block mb-3">Slope direction</span>
        <div className="grid grid-cols-3 gap-3">
          {(["left", "right", "both"] as const).map(d => (
            <button key={d} onClick={() => setDirection(d)}
              className={cn(
                "py-3 text-[11px] tracking-[0.2em] uppercase font-medium border transition-all",
                direction === d ? "border-brand-walnut text-foreground" : "border-border text-muted-foreground hover:border-foreground/40",
              )}>
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const PORTAL_OBJECT_PRESETS: { id: "door" | "window" | "tv" | "fireplace" | "other"; label: string; icon: React.ElementType }[] = [
  { id: "door", label: "Door", icon: DoorOpen },
  { id: "window", label: "Window", icon: HelpCircle },
  { id: "tv", label: "TV", icon: Monitor },
  { id: "fireplace", label: "Fireplace", icon: Flame },
  { id: "other", label: "Other", icon: HelpCircle },
]

function PortalDimsContent(props: {
  wallW: number; setWallW: (v: number) => void
  wallH: number; setWallH: (v: number) => void
  objW: number; setObjW: (v: number) => void
  objH: number; setObjH: (v: number) => void
  floorToObj: number; setFloorToObj: (v: number) => void
  rightGap: number; setRightGap: (v: number) => void
  objType: "door" | "window" | "tv" | "fireplace" | "other"
  setObjType: (t: "door" | "window" | "tv" | "fireplace" | "other") => void
}) {
  const { wallW, setWallW, wallH, setWallH, objW, setObjW, objH, setObjH, floorToObj, setFloorToObj, rightGap, setRightGap, objType, setObjType } = props
  const leftGap = Math.max(0, wallW - objW - rightGap)
  const minWallH = Math.min(144, Math.max(60, floorToObj + objH))
  const effectiveWallH = Math.min(144, Math.max(wallH, minWallH))
  useEffect(() => {
    if (wallH < minWallH) setWallH(minWallH)
  }, [wallH, minWallH, setWallH])
  return (
    <div className="space-y-8">
      <div>
        <span className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground block mb-3">Object type</span>
        <div className="grid grid-cols-5 gap-2">
          {PORTAL_OBJECT_PRESETS.map(p => {
            const selected = objType === p.id
            const IconCmp: any = p.icon
            return (
              <button key={p.id} onClick={() => {
                setObjType(p.id)
                if (p.id === "door") { setObjW(36); setObjH(82); setFloorToObj(0); setWallH(Math.max(wallH, 82)) }
                if (p.id === "window") { setObjW(36); setObjH(48); setFloorToObj(36); setWallH(Math.max(wallH, 84)) }
                if (p.id === "tv") { setObjW(55); setObjH(31); setFloorToObj(30); setWallH(Math.max(wallH, 61)) }
                if (p.id === "fireplace") { setObjW(48); setObjH(40); setFloorToObj(0); setWallH(Math.max(wallH, 60)) }
              }}
                className={cn(
                  "flex flex-col items-center gap-1.5 py-3 px-1 border transition-all",
                  selected ? "border-brand-walnut text-foreground" : "border-border text-muted-foreground hover:border-foreground/40",
                )}>
                <IconCmp className="h-5 w-5" />
                <span className="text-[10px] tracking-[0.15em] uppercase">{p.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <LabeledSlider label="Wall width" value={wallW} onChange={setWallW} min={48} max={240} />
      <LabeledSlider label="Wall height" value={effectiveWallH} onChange={(v) => setWallH(Math.max(v, minWallH))} min={minWallH} max={144} />
      <LabeledSlider label="Object width" value={objW} onChange={(v) => {
        const clamped = Math.min(v, Math.max(12, wallW - 14))
        setObjW(clamped)
        if (rightGap > wallW - clamped) setRightGap(Math.max(0, wallW - clamped))
      }} min={12} max={Math.max(12, wallW - 14)} />
      <LabeledSlider label="Object height" value={objH} onChange={(v) => {
        const clamped = Math.min(v, Math.max(12, effectiveWallH - floorToObj))
        setObjH(clamped)
        if (floorToObj + clamped > wallH) setWallH(floorToObj + clamped)
      }} min={12} max={Math.max(12, effectiveWallH - floorToObj)} />
      {objType !== "door" ? (
        <LabeledSlider label="Floor → object" value={floorToObj} onChange={setFloorToObj} min={0} max={Math.max(0, effectiveWallH - objH)} />
      ) : (
        <div className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground italic">
          Door sits on the floor — no shelf runs underneath
        </div>
      )}
      <LabeledSlider label="Right gap" value={rightGap} onChange={setRightGap} min={0} max={Math.max(0, wallW - objW)}
        hint={`Left gap auto: ${toFraction(leftGap)}`} />
    </div>
  )
}
