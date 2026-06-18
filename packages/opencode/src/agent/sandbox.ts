import { Log } from "@/util"
import fs from "fs"
import path from "path"

const log = Log.create({ service: "sandbox" })

export interface SandboxConfig {
  workDir: string
  tmpDir: string
  allowedPaths: string[]
  blockedCommands: string[]
  maxExecutionTime: number
  maxMemory: string
  networkAccess: boolean
  readonly: boolean
}

const defaultConfig: SandboxConfig = {
  workDir: process.cwd(),
  tmpDir: "/tmp/openfable-sandbox",
  allowedPaths: [],
  blockedCommands: ["rm -rf /", "mkfs", "dd if=", "> /dev/sd"],
  maxExecutionTime: 30_000,
  maxMemory: "512m",
  networkAccess: true,
  readonly: false,
}

export interface SandboxResult {
  stdout: string
  stderr: string
  exitCode: number
  duration: number
  timedOut: boolean
  blocked: boolean
}

export class Sandbox {
  private config: SandboxConfig

  constructor(config?: Partial<SandboxConfig>) {
    this.config = { ...defaultConfig, ...config }
    this.ensureDirs()
  }

  private ensureDirs(): void {
    if (!fs.existsSync(this.config.tmpDir)) {
      fs.mkdirSync(this.config.tmpDir, { recursive: true })
    }
  }

  async exec(command: string, options?: { timeout?: number; cwd?: string }): Promise<SandboxResult> {
    const start = Date.now()
    const timeout = options?.timeout ?? this.config.maxExecutionTime

    if (this.isBlocked(command)) {
      return {
        stdout: "",
        stderr: `Blocked command: ${command}`,
        exitCode: 126,
        duration: 0,
        timedOut: false,
        blocked: true,
      }
    }

    const wrappedCommand = this.wrapCommand(command, options?.cwd)

    try {
      const proc = Bun.spawn(["bash", "-c", wrappedCommand], {
        cwd: options?.cwd ?? this.config.workDir,
        stdout: "pipe",
        stderr: "pipe",
        signal: AbortSignal.timeout(timeout),
      })

      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited
      const duration = Date.now() - start

      return {
        stdout,
        stderr,
        exitCode,
        duration,
        timedOut: false,
        blocked: false,
      }
    } catch (error) {
      const duration = Date.now() - start
      const isTimeout = error instanceof Error && error.name === "TimeoutError"
      return {
        stdout: "",
        stderr: isTimeout ? `Command timed out after ${timeout}ms` : String(error),
        exitCode: isTimeout ? 124 : 1,
        duration,
        timedOut: isTimeout,
        blocked: false,
      }
    }
  }

  async execWithRetry(command: string, maxRetries: number = 2): Promise<SandboxResult> {
    let lastResult: SandboxResult | null = null
    for (let i = 0; i <= maxRetries; i++) {
      lastResult = await this.exec(command)
      if (lastResult.exitCode === 0) return lastResult
      if (lastResult.blocked) return lastResult
    }
    return lastResult!
  }

  private isBlocked(command: string): boolean {
    const normalized = command.toLowerCase().trim()
    return this.config.blockedCommands.some((blocked) => normalized.includes(blocked.toLowerCase()))
  }

  private wrapCommand(command: string, cwd?: string): string {
    const parts: string[] = []

    if (this.config.readonly) {
      parts.push(`mount -o bind,ro ${this.config.workDir} ${this.config.workDir} 2>/dev/null || true`)
    }

    parts.push(`cd ${cwd ?? this.config.workDir}`)
    parts.push(command)

    if (this.config.readonly) {
      parts.push(`umount ${this.config.workDir} 2>/dev/null || true`)
    }

    return parts.join(" && ")
  }

  createTempFile(name: string, content: string): string {
    const filePath = path.join(this.config.tmpDir, name)
    fs.writeFileSync(filePath, content, "utf-8")
    return filePath
  }

  readTempFile(name: string): string | null {
    const filePath = path.join(this.config.tmpDir, name)
    try {
      return fs.readFileSync(filePath, "utf-8")
    } catch {
      return null
    }
  }

  cleanupTemp(): void {
    try {
      const files = fs.readdirSync(this.config.tmpDir)
      for (const file of files) {
        fs.unlinkSync(path.join(this.config.tmpDir, file))
      }
    } catch {}
  }
}
