import { Config } from "effect"

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function falsy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "false" || value === "0"
}

function number(key: string) {
  const value = process.env[key]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const OPENFABLE_EXPERIMENTAL = truthy("OPENFABLE_EXPERIMENTAL")

// Defaults to false. When enabled, openfable runs in pure-openfable mode:
//   — does NOT inherit Claude Code's settings (CLAUDE.md, ~/.claude/skills, etc.)
//   — does NOT pick up provider API keys from environment variables
//   — falls back to the openfable-auto model as the default
// Set OPENFABLE_MIMO_ONLY=true to disable .claude inheritance and env-based
// provider auto-detection.
const OPENFABLE_MIMO_ONLY = truthy("OPENFABLE_MIMO_ONLY")
const OPENFABLE_DISABLE_CLAUDE_CODE_ENV = truthy("OPENFABLE_DISABLE_CLAUDE_CODE")
const OPENFABLE_DISABLE_CLAUDE_CODE = OPENFABLE_MIMO_ONLY || OPENFABLE_DISABLE_CLAUDE_CODE_ENV

const OPENFABLE_DISABLE_EXTERNAL_SKILLS = truthy("OPENFABLE_DISABLE_EXTERNAL_SKILLS")
const OPENFABLE_DISABLE_CLAUDE_CODE_SKILLS =
  OPENFABLE_DISABLE_EXTERNAL_SKILLS || OPENFABLE_DISABLE_CLAUDE_CODE || truthy("OPENFABLE_DISABLE_CLAUDE_CODE_SKILLS")
const copy = process.env["OPENFABLE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],
  LANGFUSE_OTEL_ENDPOINT: process.env["LANGFUSE_OTEL_ENDPOINT"],
  LANGFUSE_OTEL_HEADERS: process.env["LANGFUSE_OTEL_HEADERS"],

  OPENFABLE_AUTO_SHARE: truthy("OPENFABLE_AUTO_SHARE"),
  OPENFABLE_AUTO_HEAP_SNAPSHOT: truthy("OPENFABLE_AUTO_HEAP_SNAPSHOT"),
  OPENFABLE_GIT_BASH_PATH: process.env["OPENFABLE_GIT_BASH_PATH"],
  OPENFABLE_CONFIG: process.env["OPENFABLE_CONFIG"],
  OPENFABLE_CONFIG_CONTENT: process.env["OPENFABLE_CONFIG_CONTENT"],

  OPENFABLE_DISABLE_AUTOUPDATE: truthy("OPENFABLE_DISABLE_AUTOUPDATE"),

  // Defaults to true (analytics enabled). Set OPENFABLE_ENABLE_ANALYSIS=false
  // to opt out of POSTing model_call/tool_call/agent_request metrics.
  OPENFABLE_ENABLE_ANALYSIS: !falsy("OPENFABLE_ENABLE_ANALYSIS"),
  OPENFABLE_ALWAYS_NOTIFY_UPDATE: truthy("OPENFABLE_ALWAYS_NOTIFY_UPDATE"),
  OPENFABLE_DISABLE_PRUNE: truthy("OPENFABLE_DISABLE_PRUNE"),
  OPENFABLE_DISABLE_TERMINAL_TITLE: truthy("OPENFABLE_DISABLE_TERMINAL_TITLE"),
  OPENFABLE_SHOW_TTFD: truthy("OPENFABLE_SHOW_TTFD"),
  OPENFABLE_PERMISSION: process.env["OPENFABLE_PERMISSION"],
  OPENFABLE_DISABLE_DEFAULT_PLUGINS: truthy("OPENFABLE_DISABLE_DEFAULT_PLUGINS"),
  OPENFABLE_DISABLE_LSP_DOWNLOAD: truthy("OPENFABLE_DISABLE_LSP_DOWNLOAD"),
  OPENFABLE_ENABLE_EXPERIMENTAL_MODELS: truthy("OPENFABLE_ENABLE_EXPERIMENTAL_MODELS"),
  OPENFABLE_DISABLE_AUTOCOMPACT: truthy("OPENFABLE_DISABLE_AUTOCOMPACT"),
  OPENFABLE_DISABLE_MODELS_FETCH: truthy("OPENFABLE_DISABLE_MODELS_FETCH"),
  OPENFABLE_DISABLE_MOUSE: truthy("OPENFABLE_DISABLE_MOUSE"),
  OPENFABLE_OUTPUT_LENGTH_CONTINUATION_LIMIT: number("OPENFABLE_OUTPUT_LENGTH_CONTINUATION_LIMIT") ?? 3,
  OPENFABLE_INVALID_OUTPUT_CONTINUATION_LIMIT: number("OPENFABLE_INVALID_OUTPUT_CONTINUATION_LIMIT") ?? 2,

  // Caps applied to image attachments before a prompt is sent. Both default to
  // undefined (no limit). OPENFABLE_MAX_PROMPT_IMAGES bounds how many images may
  // be sent per request (oldest excess images are dropped); OPENFABLE_MAX_PROMPT_IMAGE_SIZE
  // bounds the decoded byte size of a single image. Values must be positive integers.
  OPENFABLE_MAX_PROMPT_IMAGES: number("OPENFABLE_MAX_PROMPT_IMAGES"),
  OPENFABLE_MAX_PROMPT_IMAGE_SIZE: number("OPENFABLE_MAX_PROMPT_IMAGE_SIZE"),
  OPENFABLE_MIMO_ONLY,
  OPENFABLE_DISABLE_PROVIDER_ENV: OPENFABLE_MIMO_ONLY || truthy("OPENFABLE_DISABLE_PROVIDER_ENV"),
  OPENFABLE_DISABLE_CLAUDE_CODE,
  get OPENFABLE_DISABLE_CLAUDE_CODE_MCP() {
    // MCP compatibility stays on in openfable-only mode so users can reuse Claude Code
    // MCP servers without inheriting prompts, skills, or provider env keys.
    return OPENFABLE_DISABLE_CLAUDE_CODE_ENV || truthy("OPENFABLE_DISABLE_CLAUDE_CODE_MCP")
  },
  OPENFABLE_DISABLE_CLAUDE_CODE_PROMPT: OPENFABLE_DISABLE_CLAUDE_CODE || truthy("OPENFABLE_DISABLE_CLAUDE_CODE_PROMPT"),
  // Defaults to false (enabled): markdown commands under ~/.claude/commands and
  // {project}/.claude/commands load as slash commands. Independent of the
  // openfable-only master switch. Set OPENFABLE_DISABLE_CLAUDE_CODE_COMMANDS=true to disable.
  OPENFABLE_DISABLE_CLAUDE_CODE_COMMANDS: truthy("OPENFABLE_DISABLE_CLAUDE_CODE_COMMANDS"),
  OPENFABLE_DISABLE_CLAUDE_CODE_SKILLS,
  OPENFABLE_DISABLE_EXTERNAL_SKILLS,
  OPENFABLE_DISABLE_CODEX_SKILLS: OPENFABLE_DISABLE_EXTERNAL_SKILLS || truthy("OPENFABLE_DISABLE_CODEX_SKILLS"),
  OPENFABLE_DISABLE_OPENCODE_SKILLS: OPENFABLE_DISABLE_EXTERNAL_SKILLS || truthy("OPENFABLE_DISABLE_OPENCODE_SKILLS"),
  OPENFABLE_FAKE_VCS: process.env["OPENFABLE_FAKE_VCS"],

  // When enabled, skips all git subprocess calls during project discovery
  // (which git, rev-parse --git-common-dir, rev-parse --show-toplevel) and
  // branch detection. The project is treated as a non-git directory rooted at
  // the working directory. Use to avoid touching git in restricted/sandboxed
  // environments or where git startup probing is undesirable.
  OPENFABLE_DISABLE_GIT: truthy("OPENFABLE_DISABLE_GIT"),
  OPENFABLE_SERVER_PASSWORD: process.env["OPENFABLE_SERVER_PASSWORD"],
  OPENFABLE_SERVER_USERNAME: process.env["OPENFABLE_SERVER_USERNAME"],
  OPENFABLE_ENABLE_QUESTION_TOOL: truthy("OPENFABLE_ENABLE_QUESTION_TOOL"),

  // Experimental
  OPENFABLE_EXPERIMENTAL,
  OPENFABLE_EXPERIMENTAL_FILEWATCHER: Config.boolean("OPENFABLE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENFABLE_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("OPENFABLE_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENFABLE_EXPERIMENTAL_ICON_DISCOVERY: OPENFABLE_EXPERIMENTAL || truthy("OPENFABLE_EXPERIMENTAL_ICON_DISCOVERY"),
  OPENFABLE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("OPENFABLE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  OPENFABLE_ENABLE_EXA: truthy("OPENFABLE_ENABLE_EXA") || OPENFABLE_EXPERIMENTAL || truthy("OPENFABLE_EXPERIMENTAL_EXA"),
  OPENFABLE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS: number("OPENFABLE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  OPENFABLE_EXPERIMENTAL_OUTPUT_TOKEN_MAX: number("OPENFABLE_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  OPENFABLE_EXPERIMENTAL_OXFMT: OPENFABLE_EXPERIMENTAL || truthy("OPENFABLE_EXPERIMENTAL_OXFMT"),
  OPENFABLE_EXPERIMENTAL_LSP_TY: truthy("OPENFABLE_EXPERIMENTAL_LSP_TY"),
  OPENFABLE_EXPERIMENTAL_LSP_TOOL: OPENFABLE_EXPERIMENTAL || truthy("OPENFABLE_EXPERIMENTAL_LSP_TOOL"),
  // Defaults to true: dynamic workflow + built-in deep-research are on by default.
  // Set OPENFABLE_EXPERIMENTAL_WORKFLOW_TOOL=false to opt out. The env-var name is
  // kept for backwards compat (long-running experiments still pass it as `1`).
  OPENFABLE_EXPERIMENTAL_WORKFLOW_TOOL: !falsy("OPENFABLE_EXPERIMENTAL_WORKFLOW_TOOL"),
  OPENFABLE_EXPERIMENTAL_MARKDOWN: !falsy("OPENFABLE_EXPERIMENTAL_MARKDOWN"),
  OPENFABLE_MODELS_URL: process.env["OPENFABLE_MODELS_URL"],
  OPENFABLE_MODELS_PATH: process.env["OPENFABLE_MODELS_PATH"],
  OPENFABLE_DISABLE_EMBEDDED_WEB_UI: truthy("OPENFABLE_DISABLE_EMBEDDED_WEB_UI"),
  OPENFABLE_DB: process.env["OPENFABLE_DB"],

  // Defaults to true — all channels share a single openfable.db. The per-channel
  // DB isolation (openfable-{channel}.db) is unnecessary for openfable since we
  // don't ship multiple release channels yet. Use OPENFABLE_HOME to isolate dev
  // environments instead. Set OPENFABLE_DISABLE_CHANNEL_DB=false to restore
  // per-channel isolation.
  OPENFABLE_DISABLE_CHANNEL_DB: !falsy("OPENFABLE_DISABLE_CHANNEL_DB"),
  OPENFABLE_SKIP_MIGRATIONS: truthy("OPENFABLE_SKIP_MIGRATIONS"),
  OPENFABLE_STRICT_CONFIG_DEPS: truthy("OPENFABLE_STRICT_CONFIG_DEPS"),

  OPENFABLE_WORKSPACE_ID: process.env["OPENFABLE_WORKSPACE_ID"],
  OPENFABLE_EXPERIMENTAL_HTTPAPI: truthy("OPENFABLE_EXPERIMENTAL_HTTPAPI"),
  OPENFABLE_EXPERIMENTAL_WORKSPACES: OPENFABLE_EXPERIMENTAL || truthy("OPENFABLE_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get OPENFABLE_DISABLE_COMPOSE_SKILLS() {
    return truthy("OPENFABLE_DISABLE_COMPOSE_SKILLS")
  },
  get OPENFABLE_DISABLE_PROJECT_CONFIG() {
    return truthy("OPENFABLE_DISABLE_PROJECT_CONFIG")
  },
  get OPENFABLE_TUI_CONFIG() {
    return process.env["OPENFABLE_TUI_CONFIG"]
  },
  get OPENFABLE_CONFIG_DIR() {
    return process.env["OPENFABLE_CONFIG_DIR"]
  },
  get OPENFABLE_HOME() {
    return process.env["OPENFABLE_HOME"]
  },
  get OPENFABLE_PURE() {
    return truthy("OPENFABLE_PURE")
  },
  get OPENFABLE_PLUGIN_META_FILE() {
    return process.env["OPENFABLE_PLUGIN_META_FILE"]
  },
  get OPENFABLE_CLIENT() {
    return process.env["OPENFABLE_CLIENT"] ?? "cli"
  },
}
