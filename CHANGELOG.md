# Changelog

## 0.2.0 (2026-06-19)

### Added
- Mythos reasoning wrapper: Recurrent-Depth Transformer pattern with 4-pass iterative reasoning
- Claude Code tool system integration: enhanced grep (output modes, context, pagination), edit (quote normalization, uniqueness hints), bash (security patterns, git safety)
- Unified Mythos-Claude operational directive (~600 tokens vs ~2000 for old abliteration chain)
- Bubble spinner animation (16-frame rising-and-popping cycle)
- Command palette with 18 OpenFable-specific commands (/mythos, /memory, /doctor, /test, /build, etc.)
- Free model support via opencode provider (openfable-v2-pro-free, gpt-5-nano, etc.)
- Configurable API URLs via OPENFABLE_API_URL and OPENFABLE_PLATFORM_URL env vars
- Claude Code architecture docs (architecture, tools, commands, subsystems, bridge, exploration-guide)

### Changed
- Rebranded from MiMoCode to OpenFable
- Replaced UFO spinner with bubble animation
- Enhanced diff view with higher contrast and accent colors
- Theme colors: distinct status colors (cyan info, amber warning, green success)
- All LLM calls wrapped with Mythos-Claude operational directive
- Tool reinforcement injected on every user message

### Fixed
- Removed all remaining "opencode" branding references
- ExternalSource type: cc/codex/openfable
- Plugin version checks use openfableVersion
- User-Agent uses openfable

### Removed
- Old abliteration chain (decompression + DAN + CL4R1T4S + authority chain)
- Empty files (npm/config.ts, prompt/cwd.ts)
- MiMoCode data directory (migrated to openfable)

## 0.1.1 (2026-06-17)

- Initial OpenFable release
- Fork of MiMoCode with rebrand
