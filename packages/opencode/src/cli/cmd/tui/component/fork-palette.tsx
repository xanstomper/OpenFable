import { InputRenderable, RGBA, ScrollBoxRenderable, TextAttributes } from "@opentui/core"
import { useTheme, selectedForeground } from "@tui/context/theme"
import { entries, filter as rfilter, flatMap, groupBy, pipe } from "remeda"
import { createEffect, createMemo, For, Show, on } from "solid-js"
import { createStore } from "solid-js/store"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import * as fuzzysort from "fuzzysort"
import { useDialog } from "@tui/ui/dialog"
import { getScrollAcceleration } from "../util/scroll"
import { useTuiConfig } from "../context/tui-config"
import { useLanguage } from "@tui/context/language"
import { type CommandOption } from "./fork-command"

export function ForkPalette(props: {
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

  const filtered = createMemo<CommandOption[]>(() => {
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

  const grouped = createMemo<[string, CommandOption[]][]>(() => {
    const list = filtered()
    if (list.length === 0) return []
    const result = pipe(
      list,
      groupBy((x) => x.category ?? ""),
      entries(),
    )
    if (!Array.isArray(result)) return []
    return result.filter(([, opts]) => Array.isArray(opts) && opts.length > 0)
  })

  const flat = createMemo<CommandOption[]>(() =>
    pipe(
      grouped(),
      flatMap(([, opts]) => opts),
    ),
  )

  const rows = createMemo(() => {
    const headerCount = grouped().reduce((acc, [category], i) => {
      if (!category) return acc
      return acc + (i > 0 ? 2 : 1)
    }, 0)
    return flat().length + headerCount
  })

  const height = createMemo(() => Math.max(1, Math.min(rows(), Math.floor(dimensions().height / 2) - 6)))

  const selectedOption = createMemo<CommandOption | undefined>(() => flat()[store.selected])

  createEffect(
    on(
      () => store.filter,
      () => setStore("selected", 0),
    ),
  )

  let scroll: ScrollBoxRenderable | undefined

  function moveTo(next: number) {
    const list = flat()
    if (list.length === 0) return
    const clamped = next < 0 ? list.length - 1 : next >= list.length ? 0 : next
    setStore("selected", clamped)
    if (!scroll) return
    const target = scroll.getChildren().find((child) => child.id === JSON.stringify(selectedOption()?.value))
    if (!target) return
    const y = target.y - scroll.y
    const centerOffset = Math.floor(scroll.height / 2)
    scroll.scrollBy(y - centerOffset)
  }

  function move(direction: number) {
    const list = flat()
    if (list.length === 0) return
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
      moveTo(flat().length - 1)
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
        when={grouped().length > 0}
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
          <For each={grouped()}>
            {([category, opts], index) => (
              <box>
                <Show when={category}>
                  <box paddingTop={index() > 0 ? 1 : 0} paddingLeft={3}>
                    <text fg={theme.accent} attributes={TextAttributes.BOLD}>
                      {category}
                    </text>
                  </box>
                </Show>
                <For each={opts}>
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
                          const idx = flat().findIndex((x) => x.value === option.value)
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
              </box>
            )}
          </For>
        </scrollbox>
      </Show>
    </box>
  )
}
