import * as React from "react"
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

export interface WizardStep {
  /** Short uppercase label, e.g. "TYPE", "WIDTH". */
  label: string
  /** Optional summary shown in the top-right header for the active step. */
  selectionName?: string
  /** Optional price delta shown in the top-right header. */
  priceDelta?: string
  /** Optional one-paragraph description below the selection name. */
  description?: React.ReactNode
  /** Step body — the actual swatches/sliders/etc. */
  content: React.ReactNode
  /** Hide the global Back/Next bar for this step (e.g. final review with its own CTA). */
  hideNav?: boolean
  /** Disable Next on this step (e.g. required choice not made). */
  nextDisabled?: boolean
  /** Override the default "NEXT >" label, e.g. "REVIEW >". */
  nextLabel?: string
}

interface WizardShellProps {
  preview: React.ReactNode
  steps: WizardStep[]
  index: number
  onIndexChange: (next: number) => void
  onReset?: () => void
  brand?: React.ReactNode
}

/**
 * Banyan-style step-by-step configurator shell.
 * Desktop: large preview left, step panel right.
 * Mobile: preview pinned top (~45vh via configurator-preview class), step content scrolls below.
 */
export function WizardShell({
  preview,
  steps,
  index,
  onIndexChange,
  onReset,
  brand,
}: WizardShellProps) {
  const safeIndex = Math.min(Math.max(index, 0), steps.length - 1)
  const step = steps[safeIndex]
  const total = steps.length

  const goPrev = () => safeIndex > 0 && onIndexChange(safeIndex - 1)
  const goNext = () => safeIndex < total - 1 && onIndexChange(safeIndex + 1)

  return (
    <div className="w-full configurator-root bg-background">
      <div className="flex flex-col lg:flex-row configurator-layout min-h-screen">
        {/* Brand mark — desktop only, sits over the preview corner */}
        <div className="hidden lg:block absolute top-6 left-6 z-20 text-xs tracking-[0.3em] font-semibold text-foreground/80">
          {brand ?? "PBS"}
        </div>

        {/* Preview */}
        <div className="lg:w-[58%] xl:w-[62%] flex-shrink-0 bg-secondary/40 configurator-preview relative">
          <div className="relative w-full h-[45vh] lg:h-screen lg:sticky lg:top-0">
            {preview}
          </div>
        </div>

        {/* Step panel */}
        <div className="lg:w-[42%] xl:w-[38%] flex-shrink-0 configurator-config relative flex flex-col">
          {/* Pinned price/selection bar — stays at top of panel while step body scrolls */}
          <div className="flex-shrink-0 px-6 md:px-10 lg:px-12 pt-6 lg:pt-10 bg-background z-10">
            <div className="flex items-baseline justify-between gap-4 border-b border-border pb-4 min-h-[2.5rem]">
              <span className="text-xs tracking-[0.2em] font-semibold uppercase text-foreground truncate">
                {step.selectionName ?? "—"}
              </span>
              <span className="text-xs tracking-wider font-medium text-foreground whitespace-nowrap">
                {step.priceDelta ?? ""}
              </span>
            </div>
          </div>
          <div className="flex-1 px-6 md:px-10 lg:px-12 pt-6 lg:pt-8 pb-32 configurator-config-inner overflow-y-auto">

            {/* Description */}
            {step.description && (
              <p className="text-sm leading-relaxed text-muted-foreground mt-5 max-w-prose">
                {step.description}
              </p>
            )}

            {/* Step header w/ back+next */}
            {!step.hideNav && (
              <div className="grid grid-cols-3 items-center mt-12 mb-8 gap-2">
                <button
                  onClick={goPrev}
                  disabled={safeIndex === 0}
                  className="justify-self-start text-[11px] tracking-[0.2em] font-medium uppercase text-foreground hover:text-brand-walnut disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Back
                </button>
                <div className="text-center">
                  <div className="font-display text-base tracking-[0.15em] uppercase text-foreground leading-tight">
                    {step.label}
                  </div>
                  <div className="text-[10px] tracking-[0.25em] text-muted-foreground mt-1 uppercase">
                    Step {safeIndex + 1}
                    <span className="text-foreground/40">/</span>
                    {total}
                  </div>
                </div>
                <button
                  onClick={goNext}
                  disabled={safeIndex === total - 1 || step.nextDisabled}
                  className="justify-self-end text-[11px] tracking-[0.2em] font-medium uppercase text-foreground hover:text-brand-walnut disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  {step.nextLabel ?? "Next"}
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Step body */}
            <div className="mt-2">{step.content}</div>
          </div>

          {/* Bottom-left RESET (desktop only) */}
          {onReset && (
            <button
              onClick={onReset}
              className="hidden lg:flex absolute bottom-6 left-6 items-center gap-2 px-4 py-2 rounded-full border border-foreground/80 text-[11px] tracking-[0.25em] uppercase font-medium text-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Reusable presentation primitives for step bodies ─── */

export function SwatchGrid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        "grid gap-x-3 gap-y-6",
        cols === 2 && "grid-cols-2",
        cols === 3 && "grid-cols-3",
        cols === 4 && "grid-cols-4",
      )}
    >
      {children}
    </div>
  )
}

export interface SwatchProps {
  label: string
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  badge?: string
}

export function Swatch({ label, selected, disabled, onClick, children, badge }: SwatchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex flex-col items-center gap-2 text-center transition-opacity",
        disabled && "opacity-30 cursor-not-allowed",
      )}
    >
      <div
        className={cn(
          "relative w-20 h-20 rounded-full overflow-hidden border transition-all",
          selected
            ? "border-brand-walnut ring-2 ring-brand-walnut ring-offset-2 ring-offset-background"
            : "border-border group-hover:border-foreground/40",
        )}
      >
        {children}
        {badge && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/80 text-background text-[8px] font-semibold tracking-wider py-0.5 uppercase">
            {badge}
          </span>
        )}
      </div>
      <span
        className={cn(
          "text-[11px] leading-tight tracking-wide max-w-[7rem]",
          selected ? "text-foreground font-semibold" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  )
}
