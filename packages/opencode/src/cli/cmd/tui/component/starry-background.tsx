import { createEffect, createSignal, onCleanup, onMount, createMemo } from "solid-js"
import { RGBA, StyledText, type BoxRenderable, type TextChunk, type TextRenderable } from "@opentui/core"
import { useTheme, tint } from "@tui/context/theme"

const BUBBLE_STAGES = ['·', '◦', '°', '•', '✧']

type Particle = {
  x: number
  y: number
  vy: number
  swayAmp: number
  swayHz: number
  phase: number
  stage: number
  life: number
}

function appendChunk(chunks: TextChunk[], text: string, fg?: RGBA) {
  const prev = chunks.at(-1)
  if (prev?.fg?.equals(fg) && prev.bg === undefined && prev.attributes === 0) {
    prev.text += text
    return
  }
  chunks.push({ __isChunk: true, text, fg, attributes: 0 })
}

function spawn(w: number, h: number, seed: boolean): Particle {
  return {
    x: Math.random() * w,
    y: seed ? Math.random() * h : -1,
    vy: 0.12 + Math.random() * 0.22,
    swayAmp: 0.6 + Math.random() * 1.6,
    swayHz: 0.04 + Math.random() * 0.06,
    phase: Math.random() * Math.PI * 2,
    stage: Math.random() * 1.5,
    life: 0,
  }
}

export function StarryBackground(props: { meteor?: () => boolean } = {}) {
  const { theme } = useTheme()
  const [particles, setParticles] = createSignal<Particle[]>([])
  const [size, setSize] = createSignal({ w: 80, h: 24 })
  const [frame, setFrame] = createSignal(0)
  let timer: ReturnType<typeof setInterval> | undefined
  let box: BoxRenderable | undefined
  let text: TextRenderable | undefined
  let mounted = false

  const sync = () => {
    if (!box) return
    const next = { w: box.width || 80, h: box.height || 24 }
    const cur = size()
    if (next.w === cur.w && next.h === cur.h) return
    setSize(next)
    const n = Math.max(8, Math.floor((next.w * next.h) / 45))
    const newParticles = Array.from({ length: n }, () => spawn(next.w, next.h, true))
    setParticles(newParticles)
  }

  onMount(() => {
    mounted = true
    sync()
    box?.on("resize", sync)
    // Initialize particles immediately
    const { w, h } = size()
    const n = Math.max(8, Math.floor((w * h) / 45))
    const initialParticles = Array.from({ length: n }, () => spawn(w, h, true))
    setParticles(initialParticles)
    timer = setInterval(() => {
      if (!mounted) return
      const { w, h } = size()
      setParticles((prev) => {
        const next = [...prev]
        for (let i = 0; i < next.length; i++) {
          const p = next[i]
          p.life++
          p.y += p.vy
          p.stage += 0.02 + p.vy * 0.03
          if (p.y > h || p.stage >= BUBBLE_STAGES.length) {
            next[i] = spawn(w, h, false)
          }
        }
        return next
      })
      setFrame((n) => n + 1)
    }, 50)
  })

  onCleanup(() => {
    mounted = false
    box?.off("resize", sync)
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
  })

  const isDark = createMemo(() => {
    const bg = theme.background
    return (bg.r ?? 0) + (bg.g ?? 0) + (bg.b ?? 0) < 384
  })

  const content = createMemo(() => {
    void frame()
    const parts = particles()
    const { w, h } = size()
    if (!parts.length) return new StyledText([])
    const dark = isDark()
    const grid: string[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => " "))
    const colorGrid: RGBA[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => theme.background))

    for (const p of parts) {
      const sway = Math.sin(p.life * p.swayHz * 2 * Math.PI + p.phase) * p.swayAmp
      const gx = Math.round(p.x + sway)
      const gy = h - 1 - Math.floor(p.y)
      if (gx < 0 || gx >= w || gy < 0 || gy >= h) continue
      const si = Math.min(Math.floor(p.stage), BUBBLE_STAGES.length - 1)
      grid[gy][gx] = BUBBLE_STAGES[si]
      const bubbleColor = dark
        ? tint(theme.primary, RGBA.fromInts(255, 255, 255), 0.8 + Math.sin(p.life * 0.05) * 0.15)
        : tint(theme.primary, RGBA.fromInts(0, 0, 0), 0.6 + Math.sin(p.life * 0.05) * 0.15)
      colorGrid[gy][gx] = bubbleColor
    }

    const chunks: TextChunk[] = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const char = grid[y][x] || " "
        const fg = colorGrid[y][x] || theme.background
        appendChunk(chunks, char, fg)
      }
      if (y < h - 1) chunks.push({ __isChunk: true, text: "\n", attributes: 0 })
    }
    return new StyledText(chunks)
  })

  createEffect(() => {
    if (!text) return
    text.content = content()
  })

  return (
    <box
      ref={(item: BoxRenderable) => (box = item)}
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      zIndex={0}
    >
      <text
        ref={(item: TextRenderable) => {
          text = item
          item.content = content()
        }}
        width="100%"
        height="100%"
        wrapMode="none"
        selectable={false}
      />
    </box>
  )
}