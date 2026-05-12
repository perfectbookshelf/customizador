/**
 * Capture an inline <svg> element as a PNG data URL.
 *
 * Usage:
 *   const url = await captureSvgAsPng(svgElement)            // direct element
 *   const url = await captureSvgAsPng("[data-pbs-schematic]") // selector → first <svg> inside
 *
 * Returns null if the element/SVG cannot be found or rendering fails.
 * Never throws — schematic capture is best-effort and must not block checkout.
 */
export async function captureSvgAsPng(
  target: SVGSVGElement | HTMLElement | string,
  opts: { scale?: number; background?: string } = {},
): Promise<string | null> {
  if (typeof window === "undefined") return null
  try {
    let svg: SVGSVGElement | null = null
    if (typeof target === "string") {
      const host = document.querySelector(target)
      svg = (host?.querySelector("svg") as SVGSVGElement | null) ?? null
    } else if (target instanceof SVGSVGElement) {
      svg = target
    } else {
      svg = target.querySelector("svg")
    }
    if (!svg) return null

    const scale = opts.scale ?? 2
    const background = opts.background ?? "#ffffff"

    // Determine intrinsic pixel size
    const rect = svg.getBoundingClientRect()
    const vb = svg.viewBox?.baseVal
    const width = Math.max(1, Math.round((rect.width || vb?.width || 800)))
    const height = Math.max(1, Math.round((rect.height || vb?.height || 600)))

    // Clone so we can ensure xmlns + explicit dimensions without mutating the live DOM
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink")
    clone.setAttribute("width", String(width))
    clone.setAttribute("height", String(height))
    if (!clone.getAttribute("viewBox") && vb) {
      clone.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.width} ${vb.height}`)
    }

    const xml = new XMLSerializer().serializeToString(clone)
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(svgBlob)

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error("svg image load failed"))
        i.src = url
      })

      const canvas = document.createElement("canvas")
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext("2d")
      if (!ctx) return null
      ctx.fillStyle = background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.drawImage(img, 0, 0, width, height)
      return canvas.toDataURL("image/png")
    } finally {
      URL.revokeObjectURL(url)
    }
  } catch (err) {
    console.warn("captureSvgAsPng failed", err)
    return null
  }
}
