import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { X, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { EmailSheetReview } from "./SocialProof"

interface QuoteEmailSheetProps {
  open: boolean
  onClose: () => void
  initialEmail: string
  onSubmit: (email: string) => void
}

// Locked wood-swatch preview shown inside the sheet so users see the
// finishes exist before handing over their email.
const WOOD_PREVIEW: { c1: string; c2?: string }[] = [
  { c1: "#D4A574" },                   // White Oak
  { c1: "#E8D4B8" },                   // Maple
  { c1: "#D4A574", c2: "#f5f5f5" },    // Oak / White
  { c1: "#E8D4B8", c2: "#1a1a1a" },    // Maple / Black
  { c1: "#D4A574", c2: "#1a1a1a" },    // Oak / Black
  { c1: "#5D432C" },                   // Walnut
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Mobile-first bottom sheet (becomes a centered modal on ≥sm screens) that
 * asks for the customer email before unlocking the quote. Self-contained:
 * locks body scroll while open, traps initial focus on the input, closes on
 * Escape / backdrop tap, and never causes the underlying step panel to scroll.
 */
export function QuoteEmailSheet({ open, onClose, initialEmail, onSubmit }: QuoteEmailSheetProps) {
  const [email, setEmail] = useState(initialEmail)
  const [touched, setTouched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep local state in sync if the parent provides a new initial email
  // (e.g. user edited it elsewhere) but only when the sheet (re)opens.
  useEffect(() => {
    if (open) {
      setEmail(initialEmail)
      setTouched(false)
    }
  }, [open, initialEmail])

  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Focus the input shortly after opening (gives mobile browsers time to
  // animate the sheet in before the keyboard pops).
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 120)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const trimmed = email.trim()
  const isValid = EMAIL_RE.test(trimmed) && trimmed.length <= 255
  const showError = touched && trimmed.length > 0 && !isValid

  const submit = () => {
    setTouched(true)
    if (!isValid) {
      inputRef.current?.focus()
      return
    }
    onSubmit(trimmed)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-email-sheet-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in"
      />

      {/* Sheet */}
      <div
        className={cn(
          "relative w-full sm:max-w-md bg-background border-t sm:border border-border",
          "rounded-t-2xl sm:rounded-2xl shadow-2xl",
          "px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6",
          "animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (decorative on mobile) */}
        <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/30" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="space-y-1">
            <h2
              id="quote-email-sheet-title"
              className="font-display text-lg tracking-[0.12em] uppercase text-foreground"
            >
              GET YOUR QUOTE
            </h2>
            <p className="text-sm text-muted-foreground leading-snug">
              Enter your email to see your custom price and keep your quote saved for later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <EmailSheetReview />

        {/* Wood reassurance — pick comes next */}
        <div className="mb-4 p-3 border border-dashed border-brand-walnut/40 bg-secondary/40 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-foreground">
              Pick wood &amp; finish on Step 4
            </span>
            <span className="text-[9px] tracking-[0.15em] uppercase text-brand-walnut whitespace-nowrap">
              Affects price
            </span>
          </div>
          <div className="flex items-center gap-1.5 opacity-70 pointer-events-none select-none">
            {WOOD_PREVIEW.map((w, i) => (
              <div key={i} className="w-7 h-7 rounded-full overflow-hidden border border-border relative flex-shrink-0">
                {w.c2 ? (
                  <div className="absolute inset-0 flex">
                    <div className="w-1/2 h-full" style={{ backgroundColor: w.c1 }} />
                    <div className="w-1/2 h-full" style={{ backgroundColor: w.c2 }} />
                  </div>
                ) : (
                  <div className="absolute inset-0" style={{ backgroundColor: w.c1 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
              Your email
            </span>
            <Input
              ref={inputRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={255}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={showError || undefined}
              className={cn("h-11 mt-2", showError && "border-destructive ring-1 ring-destructive")}
            />
            {showError && (
              <span className="block mt-1.5 text-xs text-destructive">
                Please enter a valid email address.
              </span>
            )}
          </label>

          <Button
            type="submit"
            disabled={!isValid}
            className="w-full h-11 text-[11px] tracking-[0.25em] uppercase font-medium"
          >
            View My Quote
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>

          <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
            We'll keep your design saved so you can pick up where you left off.
            No spam — unsubscribe anytime.
          </p>
        </form>
      </div>
    </div>
  )
}
