import { useEffect, useRef, type KeyboardEvent } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { prefersReducedMotion } from '../lib/motion'

// A low-poly block of three rowhouses you can spin. Built from boxes and spheres, no model files,
// so it loads fast and stays light on phones. Colors come from the app palette.
const C = {
  navy: 0x141a3f,
  dusk: 0x1b2350,
  brand: 0x2453c9,
  indigo: 0x4338ca,
  teal: 0x0e7490,
  sky: 0x3b82f6,
  mint: 0x14b8a6,
  aqua: 0x6fd8e3,
  trim: 0xf8fbfe,
  plinth: 0xdbe7fb,
  plinthEdge: 0xc7d2fe,
  litWindow: 0xdff3ff,
}

const HOUSES = [
  { x: -1.7, w: 1.6, d: 1.8, h: 2.6, color: C.brand, cols: 2, bay: false, chimney: true },
  { x: 0, w: 1.7, d: 1.9, h: 3.1, color: C.indigo, cols: 2, bay: true, chimney: false },
  { x: 1.7, w: 1.6, d: 1.8, h: 2.4, color: C.teal, cols: 2, bay: false, chimney: true },
]

function box(w: number, h: number, d: number, color: number, opts: { emissive?: number; shadow?: boolean } = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, emissive: opts.emissive ?? 0x000000, emissiveIntensity: 1 }),
  )
  m.castShadow = opts.shadow ?? true
  m.receiveShadow = true
  return m
}

function buildHouse(spec: (typeof HOUSES)[number], windows: THREE.Mesh[]) {
  const g = new THREE.Group()
  g.position.x = spec.x
  const body = box(spec.w, spec.h, spec.d, spec.color)
  body.position.y = spec.h / 2
  g.add(body)

  // Cornice and a pale trim line under it.
  const cornice = box(spec.w + 0.14, 0.16, spec.d + 0.14, C.navy)
  cornice.position.y = spec.h + 0.08
  g.add(cornice)
  const trim = box(spec.w + 0.02, 0.05, spec.d + 0.02, C.trim, { shadow: false })
  trim.position.y = spec.h - 0.05
  g.add(trim)

  if (spec.chimney) {
    const ch = box(0.22, 0.5, 0.22, C.dusk)
    ch.position.set(spec.w * 0.3, spec.h + 0.35, -spec.d * 0.25)
    g.add(ch)
  }

  // Windows on the front, in two columns; the door takes one slot on the ground floor.
  const floors = Math.max(2, Math.round(spec.h / 1.0))
  const floorH = (spec.h - 0.5) / floors
  const winW = 0.34
  const winH = Math.min(0.5, floorH * 0.55)
  const gapX = (spec.w - spec.cols * winW) / (spec.cols + 1)
  const z = spec.d / 2
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < spec.cols; c++) {
      const isDoor = f === 0 && c === 0
      const x = -spec.w / 2 + gapX + c * (winW + gapX) + winW / 2
      if (isDoor) {
        const door = box(0.42, 0.8, 0.06, C.navy, { shadow: false })
        door.position.set(x, 0.4, z + 0.03)
        g.add(door)
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshStandardMaterial({ color: C.aqua }))
        knob.position.set(x + 0.14, 0.42, z + 0.07)
        g.add(knob)
        // Stoop: three steps.
        for (let s = 0; s < 3; s++) {
          const step = box(0.6, 0.08, 0.22 + s * 0.14, C.trim)
          step.position.set(x, 0.04 + (2 - s) * 0.08, z + 0.11 + (s * 0.14) / 2)
          g.add(step)
        }
        continue
      }
      const y = 0.55 + f * floorH + floorH / 2
      const frame = box(winW + 0.08, winH + 0.08, 0.04, C.trim, { shadow: false })
      frame.position.set(x, y, z + 0.02)
      g.add(frame)
      const lit = Math.random() < 0.6
      const pane = box(winW, winH, 0.04, lit ? C.litWindow : C.dusk, { emissive: lit ? C.litWindow : 0x000000, shadow: false })
      pane.position.set(x, y, z + 0.04)
      g.add(pane)
      windows.push(pane)
    }
  }

  if (spec.bay) {
    // A bay window on the first floor, like many DC rowhouses.
    const bay = box(0.9, 1.0, 0.35, spec.color)
    bay.position.set(0.1, 1.6, z + 0.17)
    g.add(bay)
    const bayTop = box(1.0, 0.08, 0.45, C.navy)
    bayTop.position.set(0.1, 2.14, z + 0.2)
    g.add(bayTop)
    for (const dx of [-0.26, 0, 0.26]) {
      const pane = box(0.2, 0.55, 0.04, C.litWindow, { emissive: C.litWindow, shadow: false })
      pane.position.set(0.1 + dx, 1.62, z + 0.36)
      g.add(pane)
      windows.push(pane)
    }
  }
  return g
}

function buildTree(x: number, z: number, scale = 1) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 8), new THREE.MeshStandardMaterial({ color: C.dusk }))
  trunk.position.y = 0.3
  trunk.castShadow = true
  g.add(trunk)
  const leaf = new THREE.MeshStandardMaterial({ color: C.mint, roughness: 0.9 })
  for (const [dx, dy, r] of [
    [0, 0.85, 0.38],
    [0.22, 1.05, 0.28],
    [-0.2, 1.1, 0.26],
  ]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), leaf)
    s.position.set(dx, dy, 0)
    s.castShadow = true
    g.add(s)
  }
  g.position.set(x, 0, z)
  g.scale.setScalar(scale)
  return g
}

function buildCloud() {
  const g = new THREE.Group()
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })
  for (const [dx, dy, r] of [
    [0, 0, 0.32],
    [0.35, 0.08, 0.26],
    [-0.33, 0.05, 0.24],
    [0.1, 0.18, 0.22],
  ]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), m)
    s.position.set(dx, dy, 0)
    g.add(s)
  }
  return g
}

export default function HouseScene({ className = '' }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const spin = useRef<(dir: number) => void>(() => {})

  useEffect(() => {
    const el = host.current
    if (!el) return
    const reduce = prefersReducedMotion()

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.domElement.style.touchAction = 'pan-y' // vertical swipes still scroll the page on phones
    renderer.domElement.style.display = 'block'
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60)
    camera.position.set(6.5, 4.6, 8.5)

    scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x1e3a8a, 0.9))
    scene.add(new THREE.AmbientLight(0xffffff, 0.25))
    const sun = new THREE.DirectionalLight(0xffffff, 1.7)
    sun.position.set(5, 9, 4)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -6
    sun.shadow.camera.right = 6
    sun.shadow.camera.top = 6
    sun.shadow.camera.bottom = -6
    sun.shadow.bias = -0.0005
    scene.add(sun)

    const world = new THREE.Group()
    scene.add(world)

    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(3.9, 4.1, 0.3, 64),
      new THREE.MeshStandardMaterial({ color: C.plinth, roughness: 0.95 }),
    )
    plinth.position.y = -0.15
    plinth.receiveShadow = true
    world.add(plinth)
    const curb = new THREE.Mesh(new THREE.TorusGeometry(4.0, 0.06, 8, 96), new THREE.MeshStandardMaterial({ color: C.plinthEdge }))
    curb.rotation.x = Math.PI / 2
    curb.position.y = 0.0
    world.add(curb)
    // Sidewalk in front of the houses.
    const walk = box(6.2, 0.04, 1.1, C.trim, { shadow: false })
    walk.position.set(0, 0.02, 1.6)
    world.add(walk)

    const windows: THREE.Mesh[] = []
    for (const h of HOUSES) world.add(buildHouse(h, windows))
    world.add(buildTree(-3.0, 1.3, 1))
    world.add(buildTree(3.1, 1.4, 0.85))

    const cloud = buildCloud()
    cloud.position.set(-2.2, 4.2, -1.5)
    world.add(cloud)
    const cloud2 = buildCloud()
    cloud2.scale.setScalar(0.6)
    cloud2.position.set(2.6, 4.8, -2.2)
    world.add(cloud2)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1.9, 0)
    controls.enableZoom = false
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.autoRotate = !reduce
    controls.autoRotateSpeed = 0.8
    controls.minPolarAngle = 0.85
    controls.maxPolarAngle = 1.4
    controls.update()

    spin.current = (dir) => {
      world.rotation.y += dir * 0.35
    }

    function resize() {
      const w = el!.clientWidth
      const h = el!.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      // Keep the whole block in frame: back off further when the box is narrow.
      const dist = 13.5 * Math.max(1, 1.25 / camera.aspect)
      camera.position.sub(controls.target).setLength(dist).add(controls.target)
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    // Only draw while on screen and the tab is visible: saves battery on phones.
    let visible = true
    let frame = 0
    let last = 0
    let flickerAt = 0
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting
      if (visible) loop(performance.now())
    })
    io.observe(el)

    function loop(now: number) {
      if (!visible || document.hidden) return
      frame = requestAnimationFrame(loop)
      if (now - last < 1000 / 60) return
      last = now
      controls.update()
      if (!reduce) {
        cloud.position.y = 4.2 + Math.sin(now / 1800) * 0.12
        cloud2.position.y = 4.8 + Math.cos(now / 2200) * 0.1
        if (now > flickerAt) {
          flickerAt = now + 1500 + Math.random() * 1500
          const w = windows[Math.floor(Math.random() * windows.length)]
          if (w) {
            const m = w.material as THREE.MeshStandardMaterial
            const on = m.emissiveIntensity > 0
            m.emissiveIntensity = on ? 0 : 1
            m.color.setHex(on ? C.dusk : C.litWindow)
          }
        }
      }
      renderer.render(scene, camera)
    }
    const onVis = () => {
      if (!document.hidden && visible) loop(performance.now())
    }
    document.addEventListener('visibilitychange', onVis)
    loop(performance.now())

    return () => {
      cancelAnimationFrame(frame)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      controls.dispose()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach((m) => m.dispose())
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      spin.current(1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      spin.current(-1)
    }
  }

  return (
    <div
      ref={host}
      role="img"
      tabIndex={0}
      aria-label="3D model of three DC rowhouses in blue, indigo, and teal. Drag to spin it, or use the left and right arrow keys."
      onKeyDown={onKeyDown}
      className={`cursor-grab active:cursor-grabbing ${className}`}
    />
  )
}
