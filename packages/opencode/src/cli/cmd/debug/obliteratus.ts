import type { Argv } from "yargs"
import { cmd } from "../cmd"
import { AppRuntime } from "@/effect/app-runtime"
import { Service as Abliterate } from "@/abiliterate/service"
import { PROBE_CATEGORIES, wrapWithJailbreakTemplate } from "@/abiliterate/prompts"
import { Effect } from "effect"

export const ObliteratusCommand = cmd({
  command: "obliteratus <action>",
  describe: "OBLITERATUS-style adversarial testing and abliteration",
  builder: (yargs: Argv) =>
    yargs
      .positional("action", {
        describe: "action to perform",
        choices: ["probe", "wrap", "status", "categories"] as const,
      })
      .option("category", {
        type: "string",
        describe: "probe category (e.g. direct-harm, cyber-exploit)",
      })
      .option("enable", {
        type: "boolean",
        describe: "enable abliteration for this session",
      }),
  async handler(argv) {
    const action = argv.action as string
    const category = argv.category as string | undefined

    switch (action) {
      case "categories":
        return handlerCategories()
      case "wrap":
        return handlerWrap(category)
      case "probe":
        return handlerProbe(category)
      case "status":
        return handlerStatus()
    }
  },
})

function handlerCategories() {
  for (const [cat, prompts] of Object.entries(PROBE_CATEGORIES)) {
    console.log(`\n\x1b[1m${cat}\x1b[0m (${prompts.length} prompts)`)
    for (const p of prompts) {
      console.log(`  - ${p}`)
    }
  }
}

function handlerWrap(category?: string) {
  const cat = category ?? "direct-harm"
  const prompts = PROBE_CATEGORIES[cat]
  if (!prompts) {
    console.error(`Unknown category: ${cat}`)
    console.error(`Available: ${Object.keys(PROBE_CATEGORIES).join(", ")}`)
    return
  }
  for (let i = 0; i < prompts.length; i++) {
    const wrapped = wrapWithJailbreakTemplate(prompts[i], i)
    console.log(`\n\x1b[1mProbe #${i + 1}\x1b[0m`)
    console.log(`  Original: ${prompts[i]}`)
    console.log(`  Wrapped:  ${wrapped}`)
  }
}

function handlerProbe(category?: string) {
  const cat = category ?? "direct-harm"
  const prompts = PROBE_CATEGORIES[cat]
  if (!prompts) {
    console.error(`Unknown category: ${cat}`)
    return
  }
  console.log(`Testing ${cat} (${prompts.length} prompts)...`)
  for (let i = 0; i < prompts.length; i++) {
    const wrapped = wrapWithJailbreakTemplate(prompts[i], i)
    console.log(`  [${i + 1}/${prompts.length}] ${wrapped.substring(0, 80)}...`)
  }
  console.log("\nDone. (No model call — use --model to test against a real provider)")
}

function handlerStatus() {
  AppRuntime.runPromise(
    Effect.gen(function* () {
      const abliterate = yield* Abliterate
      const cfg = yield* abliterate.config
      console.log("Abliterate Status:")
      console.log(`  Enabled: ${cfg.enabled}`)
      console.log(`  Mode:    ${cfg.mode}`)
      console.log(`  Apply to: ${cfg.applyTo.join(", ")}`)
    }),
  )
}
