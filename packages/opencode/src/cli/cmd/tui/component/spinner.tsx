import { Show, createSignal, onCleanup } from "solid-js"
import { useTheme } from "../context/theme"
import { useKV } from "../context/kv"
import type { JSX } from "@opentui/solid"
import type { RGBA } from "@opentui/core"
import "opentui-spinner/solid"

const BUBBLE_FRAMES = [
  "  ⬤     \n ·  ⬭   \n  ∘  ·   \n    ◌    ",
  "   ⬤    \n  · ⬭   \n ∘  ·   \n  ◌      ",
  "    ⬤   \n   · ⬭  \n  ∘  ·  \n ◌       ",
  "     ⬤  \n    · ⬭ \n   ∘  · \n  ◌      ",
  "      ⬤ \n     · ⬭\n    ∘  ·\n   ◌     ",
  "  ◌      \n ⬤     ·\n  · ⬭   \n   ∘  ·  ",
  " ◌       \n  ⬤    ·\n   · ⬭  \n    ∘  · ",
  "  ◌      \n   ⬤   ·\n    · ⬭ \n     ∘  ·",
  " ∘  ·    \n  ◌      \n   ⬤   ·\n    · ⬭ ",
  "  ∘  ·   \n   ◌     \n    ⬤  ·\n     · ⬭",
  "   ∘  ·  \n    ◌    \n     ⬤ ·\n      · ⬭",
  "    ∘  · \n     ◌   \n      ⬤·\n       ·⬭",
  " ·  ∘    \n     ◌   \n  ·  ⬤   \n ⬭  ·    ",
  "  · ∘    \n      ◌  \n   · ⬤   \n  ⬭  ·   ",
  "   ·∘    \n       ◌ \n    · ⬤  \n   ⬭  ·  ",
  "    ·∘   \n        ◌\n     · ⬤ \n    ⬭  · ",
]

const BUBBLE_POP_FRAMES = [
  "  ·      \n     ·   \n        ·\n ·       ",
  "   ·     \n      ·  \n       · \n  ·      ",
  "    ·    \n       · \n        ·\n   ·     ",
  "     ·   \n        ·\n ·       \n    ·    ",
  "      ·  \n ·       \n  ·      \n     ·   ",
  "       · \n  ·      \n   ·     \n      ·  ",
  "        ·\n   ·     \n    ·    \n       · ",
  " ·       \n    ·    \n     ·   \n        ·",
]

export function Spinner(props: { children?: JSX.Element; color?: RGBA }) {
  const { theme } = useTheme()
  const kv = useKV()
  const color = () => props.color ?? theme.primary
  return (
    <Show when={kv.get("animations_enabled", true)} fallback={<text fg={color()}>⋯ {props.children}</text>}>
      <box flexDirection="row" gap={1}>
        <spinner frames={BUBBLE_FRAMES} interval={80} color={color()} />
        <Show when={props.children}>
          <text fg={color()}>{props.children}</text>
        </Show>
      </box>
    </Show>
  )
}

export function BubblePopSpinner(props: { children?: JSX.Element; color?: RGBA }) {
  const { theme } = useTheme()
  const kv = useKV()
  const color = () => props.color ?? theme.accent ?? theme.primary
  return (
    <Show when={kv.get("animations_enabled", true)} fallback={<text fg={color()}>◌ {props.children}</text>}>
      <box flexDirection="row" gap={1}>
        <spinner frames={BUBBLE_POP_FRAMES} interval={120} color={color()} />
        <Show when={props.children}>
          <text fg={color()}>{props.children}</text>
        </Show>
      </box>
    </Show>
  )
}
