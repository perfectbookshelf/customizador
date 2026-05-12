import { Suspense, useMemo, useImperativeHandle, forwardRef, useEffect, useRef, useState } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei"
import * as THREE from "three"
import { WOOD_COLORS, useWoodTexture } from "@/lib/wood-textures"

export interface Portal3DViewRef {
  captureImage: () => Promise<string>
}

interface Portal3DViewProps {
  wallWidth: number
  wallHeight: number
  objectWidth: number
  objectHeight: number
  floorToObject: number
  rightGap: number
  leftGap: number
  topHeight: number
  shelves: { height: number; depth: number }[]
  leftModules?: Array<Array<{ width: number }>>
  rightModules?: Array<Array<{ width: number }>>
  topModules?: Array<Array<{ width: number }>>
  bottomModules?: Array<Array<{ width: number }>>
  objectType?: "door" | "window" | "tv" | "fireplace" | "other"
  finish: string
  isMobile?: boolean
  hideTooltip?: boolean
  fillContainer?: boolean
  /** Show a debug overlay with wall/shelf bounds — for diagnostics. */
  debug?: boolean
}

// ─── CONSTANTS ───
const MODULE_WIDTHS = [7.25, 9.5, 11.75, 14, 16.25, 18.5, 20.75, 23]
const MAX_GAP = 23
const MIN_COL = 25
const BOARD_T = 0.75
const SAFETY = 2

function WoodMaterial({ finish, isFrame = false, size, seed = 0 }: { finish: string; isFrame?: boolean; size?: { w?: number; h?: number; d?: number }; seed?: number }) {
  const tex = useWoodTexture(finish, size || {}, seed)
  if (!tex) return <meshStandardMaterial color={WOOD_COLORS[finish] || WOOD_COLORS.Oak} roughness={isFrame ? 0.7 : 0.8} metalness={0} side={THREE.DoubleSide} envMapIntensity={0.3} />
  return <meshStandardMaterial map={tex} roughness={isFrame ? 0.6 : 0.7} metalness={0} side={THREE.DoubleSide} envMapIntensity={0.3} />
}

// ─── 3D PRIMITIVES ───
function Board({ pos, w, d, finish, zOff = 0 }: { pos: [number, number, number]; w: number; d: number; finish: string; zOff?: number }) {
  const geo = useMemo(() => new THREE.BoxGeometry(Math.max(w, 0.01), BOARD_T, d), [w, d])
  if (w <= 0) return null
  return (
    <mesh position={[pos[0], pos[1] + BOARD_T / 2, pos[2] + zOff]} castShadow receiveShadow geometry={geo}>
      <WoodMaterial finish={finish} />
    </mesh>
  )
}

function SidePanel({ x, h, d, finish }: { x: number; h: number; d: number; finish: string }) {
  return (
    <mesh position={[x, h / 2, -d / 2]} castShadow receiveShadow>
      <boxGeometry args={[BOARD_T, h, d]} />
      <WoodMaterial finish={finish} isFrame />
    </mesh>
  )
}

function Baguete({ position, height, finish, zOff = 0 }: { position: [number, number, number]; height: number; finish: string; zOff?: number }) {
  return (
    <mesh position={[position[0], position[1], position[2] + zOff]} castShadow receiveShadow>
      <boxGeometry args={[BOARD_T, height, 0.5]} />
      <WoodMaterial finish={finish} isFrame />
    </mesh>
  )
}

function ModuleBox({ pos, w, h, d, intF, frameF, backF, zOff = 0 }: {
  pos: [number, number, number]; w: number; h: number; d: number; intF: string; frameF: string; backF?: string; zOff?: number
}) {
  const bH = h + 0.625
  const bOff = -0.3125
  return (
    <group position={pos}>
      {/* left side */}
      <mesh position={[-w / 2 + BOARD_T / 2, h / 2, -d / 2 + zOff]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_T, h, d]} />
        <WoodMaterial finish={intF} />
      </mesh>
      {/* right side */}
      <mesh position={[w / 2 - BOARD_T / 2, h / 2, -d / 2 + zOff]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_T, h, d]} />
        <WoodMaterial finish={intF} />
      </mesh>
      {/* back */}
      <mesh position={[0, h / 2 + bOff, -d - BOARD_T / 2 + zOff]} castShadow receiveShadow>
        <boxGeometry args={[w - BOARD_T * 2, bH, BOARD_T]} />
        <WoodMaterial finish={backF ?? intF} />
      </mesh>
      {/* baguetes */}
      <Baguete position={[-w / 2 + BOARD_T / 2, bH / 2 + bOff, 0]} height={bH} finish={frameF} zOff={zOff} />
      <Baguete position={[w / 2 - BOARD_T / 2, bH / 2 + bOff, 0]} height={bH} finish={frameF} zOff={zOff} />
    </group>
  )
}

// ─── MODULE CALCULATION ───
function calcModulesForWidth(totalW: number, startIdx: number): { widths: number[]; nextIdx: number } {
  if (totalW < MODULE_WIDTHS[0]) return { widths: [], nextIdx: startIdx }
  const ws: number[] = []
  let idx = startIdx
  ws.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length]); idx++
  ws.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length]); idx++
  let sum = ws.reduce((a, b) => a + b, 0)
  while (totalW - sum > MAX_GAP * (ws.length - 1)) {
    ws.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length]); idx++
    sum = ws.reduce((a, b) => a + b, 0)
  }
  while (ws.length > 1 && ws.reduce((a, b) => a + b, 0) > totalW) { ws.pop(); idx-- }
  if (ws.length === 1 && ws[0] > totalW) return { widths: [], nextIdx: startIdx }
  return { widths: ws, nextIdx: idx % MODULE_WIDTHS.length }
}

// Re-export + locally use the pure split-board helpers.
import {
  computePortalFloorSegments as _computePortalFloorSegments,
  computePortalShelfBoardSegments as _computePortalShelfBoardSegments,
  calcModulesForSegment,
  PORTAL_MIN_MODULES_PER_BOARD,
} from "@/lib/portal-geometry"
export {
  computePortalFloorSegments,
  computePortalShelfBoardSegments,
  computeSplitBoardSegments,
  calcModulesForSegment,
  floorBoardCrossesObject,
  PORTAL_MIN_COL,
  PORTAL_BOARD_T,
  PORTAL_MIN_MODULES_PER_BOARD,
  PORTAL_MODULE_WIDTHS,
} from "@/lib/portal-geometry"
export type { PortalGeometryInput, PortalBoardSegment } from "@/lib/portal-geometry"

// ─── CANVAS HELPERS ───
function CanvasCapture({ onReady }: { onReady: (fn: () => Promise<string>) => void }) {
  const { gl, scene, camera } = useThree()
  useMemo(() => {
    onReady(async () => new Promise((resolve) => {
      requestAnimationFrame(() => { gl.render(scene, camera); resolve(gl.domElement.toDataURL("image/png")) })
    }))
  }, [gl, scene, camera, onReady])
  return null
}

function CameraController({ wallWidth, wallHeight, maxDepth, isMobile, resetKey }: {
  wallWidth: number; wallHeight: number; maxDepth: number; isMobile?: boolean; resetKey: number
}) {
  const { camera, controls, size } = useThree()
  const ctrlRef = useRef(controls)
  useEffect(() => { ctrlRef.current = controls }, [controls])
  useEffect(() => {
    const fov = 60, fovR = (fov * Math.PI) / 180, ar = size.width / Math.max(size.height, 1)
    const dW = wallWidth / 2 / Math.tan(fovR / 2) / ar
    const dH = wallHeight / 2 / Math.tan(fovR / 2)
    const pad = isMobile ? 1.6 : 1.8
    const dist = Math.max(dW, dH, maxDepth * 2.5) * pad
    const yOff = 0
    const tgt = new THREE.Vector3(0, wallHeight * 0.5 + yOff, dist)
    const look = new THREE.Vector3(0, wallHeight / 2 + yOff, 0)
    const start = camera.position.clone()
    const t0 = Date.now()
    const anim = () => {
      const p = Math.min((Date.now() - t0) / 600, 1)
      const e = 1 - Math.pow(1 - p, 3)
      camera.position.lerpVectors(start, tgt, e)
      if (ctrlRef.current && "target" in ctrlRef.current) {
        const c = ctrlRef.current as any; c.target.copy(look); c.update()
      }
      if (p < 1) requestAnimationFrame(anim)
    }
    anim()
  }, [resetKey, camera, isMobile, wallWidth, wallHeight, maxDepth])
  return null
}

// ─── MAIN SCENE ───
function PortalScene({ props, intF, frameF, backF }: { props: Portal3DViewProps; intF: string; frameF: string; backF: string }) {
  const { wallWidth, wallHeight, shelves, objectType } = props
  const isDoor = objectType === "door"
  // Defensive clamp — never let the object render outside the wall, regardless of saved/in-flight state.
  const objectWidth = Math.max(0, Math.min(props.objectWidth, wallWidth))
  const objectHeight = Math.max(0, Math.min(props.objectHeight, wallHeight))
  // Doors always sit on the floor — force floorToObject = 0 regardless of upstream state.
  const floorToObject = isDoor
    ? 0
    : Math.max(0, Math.min(props.floorToObject, Math.max(0, wallHeight - objectHeight)))
  const rightGap = Math.max(0, Math.min(props.rightGap, Math.max(0, wallWidth - objectWidth)))
  const leftGap = Math.max(0, Math.min(props.leftGap, Math.max(0, wallWidth - objectWidth - rightGap)))
  const maxDepth = shelves.length > 0 ? Math.max(...shelves.map(s => s.depth)) : 7
  const defDepth = shelves.length > 0 ? shelves[0].depth : maxDepth

  // Scene coords: wall centered at x=0
  const wL = -wallWidth / 2

  // Object zone in wall-relative coords (0..wallWidth)
  const objL = leftGap
  const objR = leftGap + objectWidth
  const objBot = floorToObject
  const objTop = floorToObject + objectHeight
  // Object zone with safety margin
  const safeBot = objBot - SAFETY
  const safeTop = objTop + SAFETY

  // Side support: a side zone is usable iff its own module sequence (reset per
  // segment) yields ≥2 modules — same gravity rule as the board splitter.
  const hasLeft = calcModulesForSegment(leftGap, 0).length >= PORTAL_MIN_MODULES_PER_BOARD
  const hasRight = calcModulesForSegment(rightGap, 0).length >= PORTAL_MIN_MODULES_PER_BOARD

  // ─── Compute shelf row Y positions ───
  const rows = useMemo(() => {
    const r: { y: number; shelf: { height: number; depth: number } }[] = []
    let y = 0
    for (const s of shelves) {
      const next = y + s.height + BOARD_T
      if (next > wallHeight + 0.01) break
      r.push({ y, shelf: s })
      y = next
    }
    return r
  }, [shelves, wallHeight])

  // Anchor the structure's top to the wall height so the slider has a visible
  // effect even when the shelf stack is shorter than the wall. The top board
  // sits flush with wallHeight; side panels run the full wall.
  const shelvesTop = rows.length > 0 ? rows[rows.length - 1].y + BOARD_T + rows[rows.length - 1].shelf.height : 0
  // Anchor the structure's top to the shelf stack — never to wallHeight.
  // Anchoring to wallHeight produced a phantom full-width board floating above
  // the shelves that crossed through the door/portal zone.
  const lastTop = shelvesTop

  // ─── Compute modules per row ───
  const rowModules = useMemo(() => {
    const result: { positions: { x: number; w: number }[]; zone: "left" | "right" | "center" | "skip" }[][] = []
    let seqIdx = 0
    for (const row of rows) {
      const { widths, nextIdx } = calcModulesForWidth(wallWidth, seqIdx)
      seqIdx = nextIdx
      const totalModW = widths.reduce((a, b) => a + b, 0)
      const gap = widths.length > 1 ? (wallWidth - totalModW) / (widths.length - 1) : 0

      const moduleY = row.y + BOARD_T
      const rowTop = row.y + row.shelf.height + BOARD_T
      const rowOverlapsObj = moduleY < safeTop && rowTop > safeBot

      const mods: { positions: { x: number; w: number }[]; zone: string }[] = []
      let x = 0
      for (const w of widths) {
        const modL = x
        const modR = x + w
        if (rowOverlapsObj) {
          // Row overlaps object: only render in left/right zones if they're wide enough
          if (modR <= objL) {
            if (hasLeft) mods.push({ positions: [{ x: modL, w }], zone: "left" })
          } else if (modL >= objR) {
            if (hasRight) mods.push({ positions: [{ x: modL, w }], zone: "right" })
          }
          // center zone: skip entirely
        } else {
          // Row does NOT overlap object: render all modules across full width
          mods.push({ positions: [{ x: modL, w }], zone: "full" })
        }
        x += w + gap
      }
      result.push(mods as any)
    }
    return result
  }, [rows, wallWidth, objL, objR, safeBot, safeTop, hasLeft, hasRight, objectWidth])

  // Compute floor band segments (≥2-module verified).
  const floorSegs = _computePortalFloorSegments({
    wallWidth, wallHeight, objectWidth, objectHeight,
    floorToObject, leftGap, rightGap, isDoor,
  })
  // Top frame board segments (≥2-module verified).
  const topSegs = _computePortalShelfBoardSegments({
    wallWidth, leftGap, rightGap, objectWidth,
    objectBot: objBot, objectTop: objTop, boardY: lastTop,
  })
  // Side panels: only meaningful when that side actually carries emitted boards.
  const sidePanelLeft = floorSegs.some(s => s.side === "left" || s.side === "full") || topSegs.some(s => s.side === "left" || s.side === "full")
  const sidePanelRight = floorSegs.some(s => s.side === "right" || s.side === "full") || topSegs.some(s => s.side === "right" || s.side === "full")

  return (
    <group>
      {/* ══════ OUTER FRAME ══════ */}
      {/* Bottom board(s) — split + ≥2-module verified */}
      {floorSegs.map((s, i) => (
        <Board key={`floor-${i}`} pos={[wL + s.x + s.w / 2, 0, -defDepth / 2]} w={s.w} d={defDepth} finish={intF} zOff={-(maxDepth - defDepth)} />
      ))}
      {/* Top board: each shelf row already renders its own top board via
          renderShelfBoard(topBoardY) below. Drawing another board here at
          lastTop (= shelvesTop) produced a duplicate "phantom" shelf on top. */}
      {/* Side panels — only if that side carries board segments */}
      {sidePanelLeft && <SidePanel x={wL + BOARD_T / 2} h={lastTop + BOARD_T} d={maxDepth} finish={intF} />}
      {sidePanelRight && <SidePanel x={wL + wallWidth - BOARD_T / 2} h={lastTop + BOARD_T} d={maxDepth} finish={intF} />}


      {/* ══════ SHELF ROWS ══════ */}
      {rows.map((row, ri) => {
        const { y: rowY, shelf } = row
        const moduleY = rowY + BOARD_T
        const topBoardY = moduleY + shelf.height
        const zOff = -(maxDepth - shelf.depth)

        const rowOverlapsObj = moduleY < safeTop && (topBoardY + BOARD_T) > safeBot

        // Render a horizontal shelf board, splitting + ≥2-module verifying
        const renderShelfBoard = (by: number, key: string) => {
          const segs = _computePortalShelfBoardSegments({
            wallWidth, leftGap, rightGap, objectWidth,
            objectBot: objBot, objectTop: objTop, boardY: by,
          })
          return segs.map((s, i) => (
            <Board key={`${key}-${i}`} pos={[wL + s.x + s.w / 2, by, -shelf.depth / 2]} w={s.w} d={shelf.depth} finish={intF} zOff={zOff} />
          ))
        }

        return (
          <group key={ri}>
            {/* Bottom board of this row (skip row 0, already rendered as outer frame) */}
            {ri > 0 && renderShelfBoard(rowY, `rb${ri}`)}
            {/* Top board of this row */}
            {renderShelfBoard(topBoardY, `rt${ri}`)}

            {/* Modules — only skip center zone modules when row overlaps object */}
            {rowModules[ri]?.map((mod: any, mi: number) => {
              const { x: modX, w: modW } = mod.positions[0]
              // Only skip modules in the object/center zone when the row actually overlaps the object vertically
              if (rowOverlapsObj && mod.zone === "center") return null
              return (
                <ModuleBox
                  key={`m${ri}-${mi}`}
                  pos={[wL + modX + modW / 2, moduleY, 0]}
                  w={modW} h={shelf.height} d={shelf.depth}
                  intF={intF} frameF={frameF}
                  backF={backF}
                  zOff={zOff}
                />
              )
            })}
          </group>
        )
      })}

      {/* ══════ OBJECT PLACEHOLDER ══════ */}
      <mesh position={[wL + objL + objectWidth / 2, floorToObject + objectHeight / 2, -maxDepth / 2]}>
        <boxGeometry args={[objectWidth, objectHeight, 1]} />
        <meshStandardMaterial color="#333333" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments position={[wL + objL + objectWidth / 2, floorToObject + objectHeight / 2, -maxDepth / 2 + 0.6]}>
        <edgesGeometry args={[new THREE.BoxGeometry(objectWidth, objectHeight, 0.1)]} />
        <lineBasicMaterial color="#666666" />
      </lineSegments>
    </group>
  )
}

// ─── EXPORTED COMPONENT ───
export const Portal3DView = forwardRef<Portal3DViewRef, Portal3DViewProps>(
  function Portal3DView(props, ref) {
    const { wallWidth, wallHeight, finish, isMobile, hideTooltip, fillContainer, debug, shelves, objectType, floorToObject, objectHeight } = props
    const parts = finish.includes("/") ? finish.split("/").map(s => s.trim()) : null
    const isTwoToneBlack = parts && parts[1] === "Black"
    const intF = isTwoToneBlack ? parts[0] : parts ? parts[1] : finish
    const frameF = isTwoToneBlack ? "Black" : parts ? parts[0] : finish
    const backF = parts ? parts[0] : finish
    const [resetCount, setResetCount] = useState(0)

    useEffect(() => {
      const timers = [200, 600, 1200, 2000].map((d) => setTimeout(() => setResetCount((c) => c + 1), d))
      return () => timers.forEach(clearTimeout)
    }, [])

    let captureFn: (() => Promise<string>) | null = null
    useImperativeHandle(ref, () => ({
      captureImage: async () => { if (captureFn) return await captureFn(); throw new Error("Canvas not ready") },
    }))

    const maxDepth = props.shelves.length > 0 ? Math.max(...props.shelves.map(s => s.depth)) : 7
    const camDist = Math.max(wallWidth * 1.2, wallHeight * 1.2, maxDepth * 5)

    // ─── Debug metrics (mirror PortalScene logic) ───
    const dbg = useMemo(() => {
      const isDoor = objectType === "door"
      const effFloorToObj = isDoor ? 0 : Math.max(0, Math.min(floorToObject, Math.max(0, wallHeight - objectHeight)))
      let shelvesTop = 0
      let renderedShelves = 0
      let y = 0
      for (const s of shelves) {
        const next = y + s.height + BOARD_T
        if (next > wallHeight + 0.01) break
        renderedShelves++
        y = next
        shelvesTop = y
      }
      const lastTop = shelvesTop
      const objTop = effFloorToObj + objectHeight
      const topBoardOverlapsObj = lastTop < objTop && lastTop + BOARD_T > effFloorToObj
      const topBoardMode: "split" | "full" | "none" =
        !topBoardOverlapsObj && lastTop > shelvesTop + 0.01 ? "full"
          : topBoardOverlapsObj ? "split" : "none"
      const phantom = lastTop - shelvesTop > BOARD_T + 0.01
      return {
        isDoor, effFloorToObj, shelvesTop, lastTop, renderedShelves,
        clippedShelves: shelves.length - renderedShelves,
        topBoardMode, phantom,
      }
    }, [shelves, wallHeight, objectType, floorToObject, objectHeight])

    return (
      <div className={
        fillContainer
          ? "relative w-full h-full overflow-hidden bg-transparent"
          : `relative w-full overflow-hidden rounded-lg border-2 border-border bg-gradient-to-b from-secondary to-muted ${isMobile ? "h-[35vh]" : "min-h-[500px] aspect-[4/3]"}`
      }>
        <Canvas
          camera={{ position: [0, wallHeight * 0.5, camDist], fov: 60 }}
          shadows
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, preserveDrawingBuffer: true }}
        >
          <Suspense fallback={null}>
            <CanvasCapture onReady={(fn) => { captureFn = fn }} />
            <CameraController wallWidth={wallWidth} wallHeight={wallHeight} maxDepth={maxDepth} isMobile={isMobile} resetKey={resetCount} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[15, 20, 10]} intensity={1.2} castShadow shadow-mapSize-width={4096} shadow-mapSize-height={4096} shadow-bias={-0.00001} shadow-camera-left={-wallWidth} shadow-camera-right={wallWidth} shadow-camera-top={wallHeight} shadow-camera-bottom={-5} />
            <directionalLight position={[-10, 10, -8]} intensity={0.4} />
            <pointLight position={[0, wallHeight * 0.7, maxDepth * 1.5]} intensity={0.8} distance={maxDepth * 4} />
            <PortalScene props={props} intF={intF} frameF={frameF} backF={backF} />
            <Environment preset="studio" environmentIntensity={0.5} />
            <ContactShadows position={[0, -0.1, 0]} opacity={0.3} scale={wallWidth * 1.8} blur={2.8} far={wallHeight * 1.5} resolution={1024} />
            <OrbitControls enableZoom enablePan enableRotate minDistance={20} maxDistance={300} target={[0, wallHeight / 2, 0]} enableDamping dampingFactor={0.05} rotateSpeed={0.5} zoomSpeed={0.5} />
          </Suspense>
        </Canvas>
        {!hideTooltip && (
          <div className="absolute bottom-4 left-4 bg-foreground/70 text-primary-foreground px-3 py-2 rounded-md text-xs">Click and drag to rotate • Right-click to pan</div>
        )}
        {debug && (
          <div className="absolute top-2 left-2 z-20 bg-background/90 backdrop-blur border border-border rounded-md p-2 text-[10px] font-mono text-foreground space-y-0.5 max-w-[240px] pointer-events-none">
            <div className="font-bold tracking-wider text-[9px] uppercase text-muted-foreground">Portal debug</div>
            <div>wallH: <span className="font-semibold">{wallHeight.toFixed(2)}"</span></div>
            <div>shelvesTop: <span className="font-semibold">{dbg.shelvesTop.toFixed(2)}"</span></div>
            <div>lastTop: <span className="font-semibold">{dbg.lastTop.toFixed(2)}"</span></div>
            <div>floor→obj: <span className="font-semibold">{dbg.effFloorToObj.toFixed(2)}"{dbg.isDoor ? " (door)" : ""}</span></div>
            <div>shelves rendered: <span className="font-semibold">{dbg.renderedShelves}/{shelves.length}</span></div>
            {dbg.clippedShelves > 0 && (
              <div className="text-destructive">⚠ {dbg.clippedShelves} clipped (exceed wallH)</div>
            )}
            <div>top board: <span className="font-semibold">{dbg.topBoardMode}</span></div>
            {dbg.phantom && (
              <div className="text-destructive">⚠ phantom top board ({(dbg.lastTop - dbg.shelvesTop).toFixed(1)}" gap above shelves)</div>
            )}
          </div>
        )}
      </div>
    )
  }
)

