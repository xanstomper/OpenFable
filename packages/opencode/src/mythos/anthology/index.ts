import { Effect, Context, Layer } from "effect"
import path from "path"
import { Global } from "../../global"
import { Log } from "../../util"

export interface AnthologyReference {
  topic: string
  path: string
  summary: string
}

export interface Interface {
  readonly getReference: (topic: string) => Effect.Effect<AnthologyReference | undefined>
  readonly listTopics: () => Effect.Effect<string[]>
  readonly getFrameworkPath: () => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@openfable/MythosAnthology") {}

const log = Log.create({ service: "mythos-anthology" })

const TOPICS: AnthologyReference[] = [
  { topic: "terminal-fundamentals", path: "01_TERMINAL_FUNDAMENTALS.md", summary: "Escape sequences, PTY, terminal stack" },
  { topic: "rendering-architecture", path: "02_RENDERING_ARCHITECTURE.md", summary: "Rendering pipelines, double buffering" },
  { topic: "layout-systems", path: "03_LAYOUT_SYSTEMS.md", summary: "Flexbox-like layout for TUI" },
  { topic: "input-systems", path: "04_INPUT_SYSTEMS.md", summary: "Keyboard, mouse, paste handling" },
  { topic: "state-management", path: "05_STATE_MANAGEMENT.md", summary: "Application state patterns" },
  { topic: "animation-systems", path: "06_ANIMATION_SYSTEMS.md", summary: "Animation and transition systems" },
  { topic: "scrolling-systems", path: "07_SCROLLING_SYSTEMS.md", summary: "Scrollback and viewport management" },
  { topic: "text-rendering", path: "08_TEXT_RENDERING.md", summary: "Text shaping, Unicode, fonts" },
  { topic: "widget-architecture", path: "09_WIDGET_ARCHITECTURE.md", summary: "Widget composition patterns" },
  { topic: "multi-pane-workspaces", path: "10_MULTI_PANE_WORKSPACES.md", summary: "Pane management and splits" },
  { topic: "concurrency", path: "11_CONCURRENCY_ARCHITECTURE.md", summary: "Async patterns for TUI" },
  { topic: "ai-agent-viz", path: "12_AI_AGENT_VISUALIZATION.md", summary: "Visualizing AI agent state" },
  { topic: "data-viz", path: "13_DATA_VISUALIZATION.md", summary: "Charts and data display" },
  { topic: "theming", path: "14_THEMING_SYSTEMS.md", summary: "Color schemes and theming" },
  { topic: "accessibility", path: "15_ACCESSIBILITY.md", summary: "Accessibility in terminal apps" },
  { topic: "persistence", path: "16_PERSISTENCE.md", summary: "Data persistence patterns" },
  { topic: "networking", path: "17_NETWORKING.md", summary: "Network protocols for TUI" },
  { topic: "performance", path: "18_PERFORMANCE_ENGINEERING.md", summary: "Performance optimization" },
  { topic: "plugin-architecture", path: "19_PLUGIN_ARCHITECTURE.md", summary: "Plugin systems" },
  { topic: "production-runtime", path: "20_PRODUCTION_RUNTIME_ARCHITECTURE.md", summary: "Production deployment" },
]

export const layer: Layer.Layer<Service> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const getReference = Effect.fn("MythosAnthology.getReference")(function* (topic: string) {
      return TOPICS.find((t) => t.topic === topic)
    })

    const listTopics = Effect.fn("MythosAnthology.listTopics")(function* () {
      return TOPICS.map((t) => t.topic)
    })

    const getFrameworkPath = Effect.fn("MythosAnthology.getFrameworkPath")(function* () {
      return path.join(Global.Path.data, "framework", "anthology")
    })

    return Service.of({ getReference, listTopics, getFrameworkPath })
  }),
)

export const defaultLayer: Layer.Layer<Service> = layer
