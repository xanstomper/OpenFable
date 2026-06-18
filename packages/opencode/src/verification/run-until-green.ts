import type { VerifyResult, Diagnostic } from "@/workflow/cognitive/state"
import { Log } from "@/util"

const log = Log.create({ service: "verification" })

export interface VerifyConfig {
  buildCommand?: string
  typeCheckCommand?: string
  lintCommand?: string
  testCommand?: string
  timeout: number
}

const defaultConfig: VerifyConfig = {
  timeout: 120_000,
}

export interface VerifyRunResult {
  result: VerifyResult
  duration: number
  commandsRun: string[]
}

export class Verifier {
  private config: VerifyConfig

  constructor(config?: Partial<VerifyConfig>) {
    this.config = { ...defaultConfig, ...config }
  }

  async runAll(projectDir: string): Promise<VerifyRunResult> {
    const start = Date.now()
    const commandsRun: string[] = []
    const diagnostics: Diagnostic[] = []

    const results = await Promise.allSettled([
      this.runCommand(this.config.buildCommand, projectDir, "build"),
      this.runCommand(this.config.typeCheckCommand, projectDir, "type"),
      this.runCommand(this.config.lintCommand, projectDir, "lint"),
      this.runCommand(this.config.testCommand, projectDir, "test"),
    ])

    let buildPass = true
    let typePass = true
    let lintPass = true
    let testPass = true

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const kind = ["build", "type", "lint", "test"][i] as Diagnostic["kind"]
      const cmd = [this.config.buildCommand, this.config.typeCheckCommand, this.config.lintCommand, this.config.testCommand][i]

      if (cmd) commandsRun.push(cmd)

      if (result.status === "fulfilled" && result.value.success) {
        continue
      }

      const pass = result.status === "fulfilled" && result.value.success
      if (kind === "build") buildPass = pass
      else if (kind === "type") typePass = pass
      else if (kind === "lint") lintPass = pass
      else if (kind === "test") testPass = pass

      if (!pass) {
        const output = result.status === "fulfilled" ? result.value.output : String(result.reason)
        diagnostics.push(...this.parseDiagnostics(output, kind))
      }
    }

    const green = buildPass && typePass && lintPass && testPass
    const duration = Date.now() - start

    log.info(`Verification ${green ? "GREEN" : "RED"} in ${duration}ms`)
    if (!green) {
      log.info(`${diagnostics.length} diagnostics found`)
    }

    return {
      result: {
        green,
        diagnostics,
        buildPass,
        typePass,
        lintPass,
        testPass,
      },
      duration,
      commandsRun,
    }
  }

  private async runCommand(
    command: string | undefined,
    cwd: string,
    kind: Diagnostic["kind"],
  ): Promise<{ success: boolean; output: string }> {
    if (!command) return { success: true, output: "" }

    try {
      const proc = Bun.spawn(["bash", "-c", command], {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
        signal: AbortSignal.timeout(this.config.timeout),
      })

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      return {
        success: exitCode === 0,
        output: stdout + stderr,
      }
    } catch (error) {
      return {
        success: false,
        output: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private parseDiagnostics(output: string, kind: Diagnostic["kind"]): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const lines = output.split("\n")

    for (const line of lines) {
      const parsed = this.parseLine(line, kind)
      if (parsed) {
        diagnostics.push(parsed)
      }
    }

    return diagnostics.length > 0 ? diagnostics : [{ file: "", line: 0, message: output.slice(0, 200), kind }]
  }

  private parseLine(line: string, kind: Diagnostic["kind"]): Diagnostic | null {
    const tsMatch = line.match(/^(.+?):(\d+):(\d+):\s*(error|warning)\s+(.+)$/)
    if (tsMatch) {
      return {
        file: tsMatch[1],
        line: parseInt(tsMatch[2]),
        message: tsMatch[5],
        kind,
      }
    }

    const rustMatch = line.match(/^error\[E(\d+)\]:\s*(.+)$/m)
    if (rustMatch) {
      return { file: "", line: 0, message: rustMatch[2], kind }
    }

    const pythonMatch = line.match(/^File "(.+?)", line (\d+)/)
    if (pythonMatch) {
      return { file: pythonMatch[1], line: parseInt(pythonMatch[2]), message: line, kind }
    }

    if (line.includes("error") || line.includes("Error") || line.includes("FAILED")) {
      return { file: "", line: 0, message: line.trim(), kind }
    }

    return null
  }
}
