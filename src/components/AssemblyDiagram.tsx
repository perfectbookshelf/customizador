/**
 * Deterministic assembly diagram for the Perfect Bookshelf system.
 *
 * IMPORTANT: This view is intentionally NOT AI-generated.
 *
 * Free-form AI exploded views were producing chaotic, inaccurate diagrams
 * (random parts, screws, impossible joints). The real system is strictly:
 *   - horizontal BOARDS
 *   - repeated MODULES (1 back panel + 2 side panels + 2 baguettes)
 *   - modules drop ONTO boards and interlock via the baguettes
 *
 * We render that logic deterministically from the configured rows so the
 * customer always sees an accurate, on-brand explanation of how their
 * bookshelf is built.
 */

export interface AssemblyRow {
  /** Module widths in this row, in inches, left-to-right. */
  moduleWidths: number[]
  /** Total available width of this row, in inches. */
  rowWidth: number
}

interface AssemblyDiagramProps {
  rows: AssemblyRow[]
  totalWidth: number
  finishLabel?: string
  finishColor?: string
  secondaryColor?: string
}

export function AssemblyDiagram({ rows, totalWidth, finishLabel, finishColor, secondaryColor }: AssemblyDiagramProps) {
  // Canvas in viewBox units. We render bottom-to-top so the lowest shelf is
  // visually at the bottom.
  const VB_W = 1000
  const VB_H = 560
  const PAD_X = 60
  const PAD_TOP = 70
  const PAD_BOTTOM = 60

  const drawableW = VB_W - PAD_X * 2
  const drawableH = VB_H - PAD_TOP - PAD_BOTTOM

  const rowCount = Math.max(1, rows.length)
  const rowH = drawableH / Math.max(1, rowCount)
  const moduleH = Math.min(rowH * 0.78, 90)
  const boardH = 8
  const scaleX = drawableW / Math.max(1, totalWidth)
  const boardFill = finishColor ?? "hsl(35 25% 78%)"
  const backPanelFill = secondaryColor ?? finishColor ?? "hsl(35 20% 88%)"
  const incomingFill = secondaryColor ?? finishColor ?? "hsl(35 20% 92%)"

  // We highlight the top row, second module from the left, as the "incoming"
  // module floating above its slot with a thin arrow indicating it drops in.
  const topRowIndex = rows.length - 1
  const incoming = (() => {
    if (!rows[topRowIndex]) return null
    const widths = rows[topRowIndex].moduleWidths
    const pick = Math.min(1, Math.max(0, widths.length - 1))
    let xOffset = 0
    for (let i = 0; i < pick; i++) xOffset += widths[i]
    const w = widths[pick]
    if (!w) return null
    const xCenter = PAD_X + (xOffset + w / 2) * scaleX
    return { xCenter, width: w * scaleX }
  })()

  // Renders one row: horizontal board + modules sitting on it.
  const renderRow = (row: AssemblyRow, visualIndex: number) => {
    // visualIndex 0 = bottom-most on screen
    const yBoard = VB_H - PAD_BOTTOM - visualIndex * rowH
    const yModuleTop = yBoard - moduleH

    let cursor = 0
    return (
      <g key={visualIndex}>
        {/* Board (horizontal plank) */}
        <rect
          x={PAD_X}
          y={yBoard - boardH}
          width={row.rowWidth * scaleX}
          height={boardH}
          fill={boardFill}
          stroke="hsl(0 0% 20%)"
          strokeWidth={1.2}
        />
        {/* Subtle baguette-slot ticks along the board top */}
        {row.moduleWidths.length > 0 &&
          (() => {
            const ticks: number[] = []
            let acc = 0
            ticks.push(acc)
            for (const w of row.moduleWidths) {
              acc += w
              ticks.push(acc)
            }
            return ticks.map((t, i) => (
              <line
                key={i}
                x1={PAD_X + t * scaleX}
                x2={PAD_X + t * scaleX}
                y1={yBoard - boardH}
                y2={yBoard - boardH - 4}
                stroke="hsl(0 0% 25%)"
                strokeWidth={1}
              />
            ))
          })()}

        {/* Modules sitting on the board */}
        {row.moduleWidths.map((w, i) => {
          const x = PAD_X + cursor * scaleX
          const widthPx = w * scaleX
          cursor += w
          const isHighlighted = visualIndex === rows.length - 1 && i === Math.min(1, row.moduleWidths.length - 1)
          // Open-front module: back panel + 2 side panels + 2 baguettes.
          return (
            <g key={i} opacity={isHighlighted ? 0 : 1}>
              {/* Back panel (subtle filled rect to show "back") */}
              <rect
                x={x + 2}
                y={yModuleTop + 2}
                width={Math.max(0, widthPx - 4)}
                height={moduleH - 4}
                fill={backPanelFill}
                stroke="hsl(0 0% 35%)"
                strokeWidth={0.8}
              />
              {/* Side panels */}
              <rect x={x} y={yModuleTop} width={3} height={moduleH} fill="hsl(0 0% 25%)" />
              <rect x={x + widthPx - 3} y={yModuleTop} width={3} height={moduleH} fill="hsl(0 0% 25%)" />
              {/* Baguettes at front edges */}
              <rect x={x + 4} y={yModuleTop} width={2} height={moduleH} fill="hsl(0 0% 15%)" />
              <rect x={x + widthPx - 6} y={yModuleTop} width={2} height={moduleH} fill="hsl(0 0% 15%)" />
            </g>
          )
        })}
      </g>
    )
  }

  return (
    <figure className="w-full max-w-3xl flex flex-col items-center gap-3">
      <div className="w-full bg-background border border-border">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto block"
          role="img"
          aria-label="Modular assembly diagram showing boards and modules stacking to form the bookshelf."
        >
          {/* light neutral background */}
          <rect width={VB_W} height={VB_H} fill="hsl(35 15% 97%)" />

          {/* Stacked rows */}
          {rows.map((r, i) => renderRow(r, i))}

          {/* Incoming/floating module above its target slot, with drop arrow */}
          {incoming && rows[topRowIndex] && (() => {
            const yBoardTop = VB_H - PAD_BOTTOM - (rows.length - 1) * rowH
            const floatY = yBoardTop - moduleH - 70
            const x = incoming.xCenter - incoming.width / 2
            const w = incoming.width
            const h = moduleH
            return (
              <g>
                {/* Floating module */}
                <rect x={x + 2} y={floatY + 2} width={Math.max(0, w - 4)} height={h - 4} fill={incomingFill} stroke="hsl(0 0% 30%)" strokeWidth={0.8} />
                <rect x={x} y={floatY} width={3} height={h} fill="hsl(0 0% 25%)" />
                <rect x={x + w - 3} y={floatY} width={3} height={h} fill="hsl(0 0% 25%)" />
                <rect x={x + 4} y={floatY} width={2} height={h} fill="hsl(0 0% 15%)" />
                <rect x={x + w - 6} y={floatY} width={2} height={h} fill="hsl(0 0% 15%)" />

                {/* Drop arrow */}
                <line
                  x1={incoming.xCenter}
                  x2={incoming.xCenter}
                  y1={floatY + h + 6}
                  y2={yBoardTop - moduleH - 6}
                  stroke="hsl(0 0% 20%)"
                  strokeWidth={1.4}
                  strokeDasharray="4 3"
                />
                <polygon
                  points={`${incoming.xCenter - 5},${yBoardTop - moduleH - 6} ${incoming.xCenter + 5},${yBoardTop - moduleH - 6} ${incoming.xCenter},${yBoardTop - moduleH + 2}`}
                  fill="hsl(0 0% 20%)"
                />
              </g>
            )
          })()}

          {/* Title strip */}
          <text x={PAD_X} y={32} fill="hsl(0 0% 15%)" fontSize="14" fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="2">
            MODULAR ASSEMBLY · BOARDS + MODULES
          </text>
          <text x={PAD_X} y={50} fill="hsl(0 0% 40%)" fontSize="11" fontFamily="ui-sans-serif, system-ui, sans-serif">
            Each module = 1 back panel + 2 side panels + 2 baguettes. Modules drop onto boards. Screw-free.
          </text>
        </svg>
      </div>
      <figcaption className="text-[11px] tracking-[0.2em] uppercase text-white/70 text-center max-w-xl leading-relaxed">
        Deterministic diagram generated from your configuration
        {finishLabel ? <span className="text-white/50"> · {finishLabel}</span> : null}
      </figcaption>
    </figure>
  )
}
