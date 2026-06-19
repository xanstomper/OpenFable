import { InputRenderable, RGBA, ScrollBoxRenderable, TextAttributes } from "@opentui/core"
import { useTheme, selectedForeground } from "@tui/context/theme"
import { createEffect, createMemo, For, Show, on } from "solid-js"
import { createStore } from "solid-js/store"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import * as fuzzysort from "fuzzysort"
import { useDialog } from "@tui/ui/dialog"
import { getScrollAcceleration } from "../util/scroll"
import { useTuiConfig } from "../context/tui-config"
import { useLanguage } from "@tui/context/language"
import { type CommandOption } from "./fork-command"

export function CommandPalette(props: {
  title: string
  options: CommandOption[]
  onSelect?: (option: CommandOption) => void
}) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()
  const t = useLanguage().t
  const dimensions = useTerminalDimensions()
  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))

  const [store, setStore] = createStore({
    selected: 0,
    filter: "",
    input: "keyboard" as "keyboard" | "mouse",
  })

  const safeOptions = createMemo<CommandOption[]>(() => (Array.isArray(props.options) ? props.options : []))

  const visible = createMemo<CommandOption[]>(() => {
    const opts = safeOptions().filter((x) => x.disabled !== true)
    const needle = store.filter.toLowerCase().trim()
    if (!needle) return opts
    return fuzzysort
      .go(needle, opts, {
        keys: ["title", "category"],
        scoreFn: (r) => (r[0] ? r[0].score : -9999) * 2 + (r[1] ? r[1].score : -9999),
      })
      .map((r) => r.obj)
  })

  const height = createMemo(() => Math.max(1, Math.min(visible().length, Math.floor(dimensions().height / 2) - 6)))

  const selectedOption = createMemo<CommandOption | undefined>(() => visible()[store.selected])

  createEffect(
    on(
      () => store.filter,
      () => setStore("selected", 0),
    ),
  )

  let scroll: ScrollBoxRenderable | undefined

  function moveTo(next: number) {
    const list = visible()
    if (list.length === 0) return
    const clamped = next < 0 ? list.length - 1 : next >= list.length ? 0 : next
    setStore("selected", clamped)
    if (!scroll) return
    const target = scroll.getChildren().find((child) => child.id === JSON.stringify(selectedOption()?.value))
    if (!target) return
    const y = target.y - scroll.y
    scroll.scrollBy(y - Math.floor(scroll.height / 2))
  }

  function move(direction: number) {
    if (visible().length === 0) return
    moveTo(store.selected + direction)
  }

  useKeyboard((evt) => {
    setStore("input", "keyboard")
    if (evt.name === "up") {
      evt.preventDefault()
      move(-1)
    } else if (evt.name === "down") {
      evt.preventDefault()
      move(1)
    } else if (evt.name === "pageup") {
      evt.preventDefault()
      move(-10)
    } else if (evt.name === "pagedown") {
      evt.preventDefault()
      move(10)
    } else if (evt.name === "home") {
      evt.preventDefault()
      moveTo(0)
    } else if (evt.name === "end") {
      evt.preventDefault()
      moveTo(visible().length - 1)
    } else if (evt.name === "return") {
      evt.preventDefault()
      evt.stopPropagation()
      const opt = selectedOption()
      if (opt) {
        if (opt.onSelect) opt.onSelect(dialog)
        props.onSelect?.(opt)
      }
    }
  })

  let input: InputRenderable | undefined

  return (
    <box gap={1} paddingBottom={1}>
      <box paddingLeft={4} paddingRight={4}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            {props.title}
          </text>
          <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
            {t("tui.dialog.close_hint")}
          </text>
        </box>
        <box paddingTop={1}>
          <input
            onInput={(e) => setStore("filter", e)}
            focusedBackgroundColor={theme.backgroundPanel}
            cursorColor={theme.primary}
            focusedTextColor={theme.textMuted}
            ref={(r) => {
              input = r
              setTimeout(() => {
                if (input && !input.isDestroyed) input.focus()
              }, 1)
            }}
            placeholder={t("tui.dialog.select.placeholder")}
            placeholderColor={theme.textMuted}
          />
        </box>
      </box>
      <Show
        when={visible().length > 0}
        fallback={
          <box paddingLeft={4} paddingRight={4} paddingTop={1}>
            <text fg={theme.textMuted}>{t("tui.dialog.select.no_results")}</text>
          </box>
        }
      >
        <scrollbox
          paddingLeft={1}
          paddingRight={1}
          scrollbarOptions={{ visible: false }}
          scrollAcceleration={scrollAcceleration()}
          ref={(r: ScrollBoxRenderable) => (scroll = r)}
          maxHeight={height()}
        >
          <For each={visible()}>
            {(option) => {
              const active = createMemo(() => selectedOption()?.value === option.value)
              return (
                <box
                  id={JSON.stringify(option.value)}
                  flexDirection="row"
                  paddingLeft={3}
                  paddingRight={3}
                  backgroundColor={active() ? (option.bg ?? theme.primary) : RGBA.fromInts(0, 0, 0, 0)}
                  onMouseMove={() => setStore("input", "mouse")}
                  onMouseOver={() => {
                    if (store.input !== "mouse") return
                    const idx = visible().findIndex((x) => x.value === option.value)
                    if (idx >= 0) setStore("selected", idx)
                  }}
                  onMouseUp={() => {
                    if (option.onSelect) option.onSelect(dialog)
                    props.onSelect?.(option)
                  }}
                >
                  <text
                    flexGrow={1}
                    fg={active() ? selectedForeground(theme) : theme.text}
                    attributes={active() ? TextAttributes.BOLD : undefined}
                    overflow="hidden"
                    wrapMode="none"
                  >
                    {option.title}
                    <Show when={option.description}>
                      <span style={{ fg: active() ? selectedForeground(theme) : theme.textMuted }}>
                        {" "}
                        {option.description}
                      </span>
                    </Show>
                  </text>
                  <Show when={option.footer}>
                    <box flexShrink={0}>
                      <text fg={active() ? selectedForeground(theme) : theme.textMuted}>{option.footer}</text>
                    </box>
                  </Show>
                </box>
              )
            }}
          </For>
        </scrollbox>
      </Show>
    </box>
  )
}
