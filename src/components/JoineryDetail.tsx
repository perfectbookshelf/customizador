import joineryPhoto from "@/assets/joinery-detail.png"

/**
 * Joinery detail card.
 *
 * IMPORTANT: This view is intentionally NOT AI-generated.
 *
 * Free-form AI image generation was producing inaccurate joinery (invented
 * screws, wrong baguette geometry, fake grooves, generic cabinet joints).
 * The Perfect Bookshelf construction system is specific — 1 back panel,
 * 2 side panels, 2 slim vertical baguettes, screw-free, sitting on a board —
 * so we show a fixed, approved close-up reference photograph of the real
 * system instead of letting the model invent one.
 */
export function JoineryDetail({
  finishLabel,
  finishColor,
  secondaryColor,
}: {
  finishLabel: string
  finishColor?: string
  secondaryColor?: string
}) {
  const tintStyle = finishColor
    ? {
        background: `linear-gradient(135deg, ${finishColor}, ${secondaryColor ?? finishColor})`,
        mixBlendMode: "color" as const,
      }
    : undefined

  return (
    <figure className="w-full max-w-3xl flex flex-col items-center gap-3">
      <div className="relative max-w-full max-h-[70vh] overflow-hidden bg-background">
        <img
          src={joineryPhoto}
          alt="Close-up of the Perfect Bookshelf baguette joinery — back panel, side panel and slim vertical baguette interlocking onto a horizontal board, with no screws or metal hardware."
          className="max-w-full max-h-[70vh] object-contain bg-background block"
          loading="lazy"
        />
        {tintStyle ? <div className="absolute inset-0 pointer-events-none opacity-40" style={tintStyle} aria-hidden="true" /> : null}
      </div>
      <figcaption className="text-[11px] tracking-[0.2em] uppercase text-white/70 text-center max-w-xl leading-relaxed">
        Screw-free baguette joinery — actual construction detail.
        {finishLabel ? (
          <span className="block mt-1 text-white/50">Approved reference, finish-tinted for your selection: {finishLabel}</span>
        ) : null}
      </figcaption>
    </figure>
  )
}
