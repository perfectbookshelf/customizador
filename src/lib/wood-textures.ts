import * as THREE from "three"
import { useTexture } from "@react-three/drei"
import { useMemo } from "react"

export const WOOD_COLORS: Record<string, string> = {
  White: "#F5F5F5",
  Maple: "#E8D4B8",
  Black: "#1A1A1A",
  Oak: "#D4A574",
  Walnut: "#5D432C",
}

// Optimized JPGs (≤200KB each) — replaces the old multi-MB PNGs.
export const WOOD_TEXTURE_URLS: Record<string, string> = {
  Maple: "/textures/maple.jpg",
  Oak: "/textures/oak.jpg",
  Walnut: "/textures/walnut.jpg",
  Black: "/textures/black.jpg",
  White: "/textures/white.jpg",
}

export const ALL_TEXTURE_URLS = Object.values(WOOD_TEXTURE_URLS)

// Preload all wood textures once on module import so they're cached
// in drei's loader cache before any Canvas mounts.
;(useTexture as unknown as { preload: (urls: string[]) => void }).preload(ALL_TEXTURE_URLS)

/**
 * Shared hook: returns a per-mesh cloned texture with UV repeat scaled
 * so the wood pattern tiles roughly every 30 inches regardless of board size.
 * This lets us use small (~80KB) JPGs without visual stretching.
 */
export function useWoodTexture(
  finish: string,
  size: { w?: number; h?: number; d?: number } = {},
  randomSeed = 0,
) {
  const url = WOOD_TEXTURE_URLS[finish]
  // Always call useTexture with a stable URL (fallback to oak) to keep hook order.
  const texture = useTexture(url || WOOD_TEXTURE_URLS.Oak) as THREE.Texture

  return useMemo(() => {
    if (!url) return null
    const t = texture.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    const u = Math.max(0.5, (size.w ?? size.d ?? 30) / 30)
    const v = Math.max(0.5, (size.h ?? size.d ?? 30) / 30)
    t.repeat.set(u, v)
    const offX = (Math.abs(randomSeed) * 0.17) % 1
    const offY = (Math.abs(randomSeed) * 0.23) % 1
    t.offset.set(offX, offY)
    t.needsUpdate = true
    return t
  }, [texture, url, size.w, size.h, size.d, randomSeed])
}
