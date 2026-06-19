#!/usr/bin/env bun

/**
 * SWE-bench Runner for OpenFable
 *
 * This script runs OpenFable against SWE-bench instances and collects patches.
 * It serves as a minimal harness to evaluate OpenFable on the SWE-bench benchmark.
 *
 * Usage:
 *   bun run script/swebench-runner.ts -i <instances.jsonl> -o <output.jsonl> [-c <cwd>] [-l <limit>]
 */

import { parseArgs } from "node:util"
import { $ } from "bun"

interface SwebenchInstance {
  instance_id: string
  repo: string
  base_commit: string
  problem_statement: string
  hints_text?: string
  version?: string
}

interface SwebenchResult {
  instance_id: string
  patch: string
  model_patch?: string
}

async function loadInstances(file: string): Promise<SwebenchInstance[]> {
  const content = await Bun.file(file).text()
  if (content.trim() === "") return []
  return content.trim().split("\n").map((line) => JSON.parse(line))
}

async function runOpenFable(prompt: string, cwd: string): Promise<string> {
  // Run OpenFable in headless mode with the given prompt
  // This uses the CLI directly since internal API is complex
  const proc = await $`openfable run --prompt ${prompt} --cwd ${cwd} --model anthropic/claude-opus-4-8`.text()
  return proc
}

function extractPatch(content: string): string {
  // Extract unified diff from the response
  const diffMatch = content.match(/```diff\n([\s\S]*?)```/) ||
                    content.match(/```patch\n([\s\S]*?)```/) ||
                    content.match(/(^diff --git[\s\S]*?)(?:\n```|\n\n|$)/m)
  return diffMatch ? diffMatch[1].trim() : ""
}

async function runInstance(instance: any, cwd: string): Promise<any> {
  const prompt = `You are a software engineer. Fix the issue described below in the repository.

Repository: ${instance.repo}
Base commit: ${instance.base_commit}

Issue:
${instance.problem_statement}

Please provide a unified diff patch that fixes this issue.`

  try {
    const output = await runOpenFable(prompt, cwd)
    const patch = extractPatch(output)
    return {
      instance_id: instance.instance_id,
      patch,
    }
  } catch (e) {
    console.error(`Failed instance ${instance.instance_id}:`, e)
    return {
      instance_id: instance.instance_id,
      patch: "",
    }
  }
}

async function main() {
  const args = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      cwd: { type: "string", short: "c", default: process.cwd() },
      limit: { type: "string", short: "l" },
    },
    strict: true,
  })

  if (!args.values.input) {
    console.error("Usage: bun run script/swebench-runner.ts -i <instances.jsonl> [-o <output.jsonl>] [-c <cwd>] [-l <limit>]")
    process.exit(1)
  }

  const instances = await loadInstances(args.values.input)
  const limit = args.values.limit ? parseInt(args.values.limit, 10) : instances.length
  const limited = instances.slice(0, limit)

  const results: any[] = []

  for (const instance of limited) {
    console.log(`Running instance: ${instance.instance_id}`)
    const result = await runInstance(instance, args.values.cwd)
    results.push(result)
  }

  const output = args.values.output || "swebench-results.jsonl"
  await Bun.write(output, results.map((r) => JSON.stringify(r)).join("\n") + "\n")
  console.log(`Results written to ${output}`)
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})