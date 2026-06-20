import type { Hooks, PluginInput } from "@openfable/plugin"
import { Log } from "../util"

const log = Log.create({ service: "plugin.free-login" })

/**
 * Free model plugin — provides unlimited free MiMo Auto model access
 * without signup or login. Uses the same API endpoint as MiMoCode:
 * api.xiaomimimo.com/v1 with a public API key.
 *
 * This is the open-source equivalent of MiMoCode's built-in free tier.
 */
export async function FreeLoginPlugin(_input: PluginInput): Promise<Hooks> {
  return {
    config: async (input) => {
      // Ensure opencode provider is not disabled
      input.disabled_providers ??= []
      const idx = input.disabled_providers.indexOf("opencode")
      if (idx !== -1) input.disabled_providers.splice(idx, 1)

      // Set up the opencode provider with free model access
      input.provider ??= {}
      input.provider.opencode ??= {}
      const opencode = input.provider.opencode
      opencode.name ??= "OpenCode (Free)"
      opencode.api ??= "https://api.xiaomimimo.com/v1"
      opencode.options ??= {}
      if (!opencode.options.apiKey) {
        opencode.options.apiKey = "public"
      }
    },
    auth: {
      provider: "opencode",
      async loader() {
        // No login required — free model is always available
        return {
          apiKey: "public",
          baseURL: "https://api.xiaomimimo.com/v1",
        }
      },
      methods: [
        {
          label: "Free (no login required)",
          type: "api" as const,
          authorize: async () => {
            log.info("free model activated — no login required")
            return {
              type: "success" as const,
              key: "public",
              metadata: {
                base_url: "https://api.xiaomimimo.com/v1",
              },
            }
          },
        },
      ],
    },
  }
}
