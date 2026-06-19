import { createMemo, For, Show } from "solid-js"
import { useTheme, selectedForeground } from "@tui/context/theme"
import { RGBA, TextAttributes } from "@opentui/core"
import { useLocal } from "@tui/context/local"
import { useDialog } from "@tui/ui/dialog"
import { useLanguage } from "@tui/context/language"

export function DialogAgent() {
  const local = useLocal()
  const dialog = useDialog()
  const { theme } = useTheme()
  const t = useLanguage().t

  const agents = createMemo(() => {
    return (local.agent.list() ?? []).map((item) => ({
      name: item.name,
      description: item.description ?? "",
    }))
  })

  return (
    <box gap={1} paddingBottom={1}>
      <box paddingLeft={4} paddingRight={4}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            {t("tui.command.agent.list.title")}
          </text>
          <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
            {t("tui.dialog.close_hint")}
          </text>
        </box>
      </box>
      <For each={agents()}>
        {(agent) => {
          const active = () => local.agent.current()?.name === agent.name
          const agentColor = local.agent.color(agent.name)
          return (
            <box
              flexDirection="row"
              paddingLeft={3}
              paddingRight={3}
              backgroundColor={active() ? theme.primary : RGBA.fromInts(0, 0, 0, 0)}
              onMouseUp={() => {
                local.agent.set(agent.name)
                dialog.clear()
              }}
            >
              <text
                flexGrow={1}
                fg={active() ? selectedForeground(theme) : theme.text}
                attributes={active() ? TextAttributes.BOLD : undefined}
                overflow="hidden"
                wrapMode="none"
              >
                {agent.name}
                <Show when={agent.description}>
                  <span style={{ fg: active() ? selectedForeground(theme) : theme.textMuted }}>
                    {" "}
                    — {agent.description}
                  </span>
                </Show>
              </text>
              <Show when={active()}>
                <box flexShrink={0}>
                  <text fg={selectedForeground(theme)}>●</text>
                </box>
              </Show>
            </box>
          )
        }}
      </For>
    </box>
  )
}
