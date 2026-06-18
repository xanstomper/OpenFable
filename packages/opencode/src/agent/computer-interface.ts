import { Log } from "@/util"
import path from "path"
import fs from "fs"

const log = Log.create({ service: "agent-computer-interface" })

export interface ACICommand {
  name: string
  description: string
  usage: string
  execute: (args: string[], context: ACIContext) => Promise<ACIResult>
}

export interface ACIResult {
  output: string
  success: boolean
  metadata?: Record<string, any>
}

export interface ACIContext {
  workDir: string
  fileSystem: ACIFileSystem
  shell: ACIShell
  search: ACISearch
}

export interface ACIFileSystem {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listDir(path: string): Promise<string[]>
  exists(path: string): Promise<boolean>
  stat(path: string): Promise<{ size: number; mtime: number }>
}

export interface ACIShell {
  exec(command: string, timeout?: number): Promise<{ stdout: string; stderr: string; exitCode: number }>
}

export interface ACISearch {
  grep(pattern: string, path: string): Promise<Array<{ file: string; line: number; content: string }>>
  glob(pattern: string, path: string): Promise<string[]>
  findDefinition(symbol: string): Promise<Array<{ file: string; line: number; kind: string }>>
  findReferences(symbol: string): Promise<Array<{ file: string; line: number; content: string }>>
}

export class AgentComputerInterface {
  private commands: Map<string, ACICommand> = new Map()
  private context: ACIContext
  private history: Array<{ command: string; args: string[]; result: ACIResult; timestamp: number }> = []

  constructor(workDir: string) {
    this.context = this.createContext(workDir)
    this.registerBuiltinCommands()
  }

  private createContext(workDir: string): ACIContext {
    const context: ACIContext = {
      workDir,
      fileSystem: {
        async readFile(filePath: string): Promise<string> {
          const resolved = path.resolve(workDir, filePath)
          return fs.promises.readFile(resolved, "utf-8")
        },
        async writeFile(filePath: string, content: string): Promise<void> {
          const resolved = path.resolve(workDir, filePath)
          await fs.promises.writeFile(resolved, content, "utf-8")
        },
        async listDir(dirPath: string): Promise<string[]> {
          const resolved = path.resolve(workDir, dirPath)
          const entries = await fs.promises.readdir(resolved, { withFileTypes: true })
          return entries.map((e) => e.name + (e.isDirectory() ? "/" : ""))
        },
        async exists(filePath: string): Promise<boolean> {
          const resolved = path.resolve(workDir, filePath)
          try {
            await fs.promises.access(resolved)
            return true
          } catch {
            return false
          }
        },
        async stat(filePath: string): Promise<{ size: number; mtime: number }> {
          const resolved = path.resolve(workDir, filePath)
          const s = await fs.promises.stat(resolved)
          return { size: s.size, mtime: s.mtimeMs }
        },
      },
      shell: {
        async exec(command: string, timeout: number = 30_000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
          const proc = Bun.spawn(["bash", "-c", command], {
            cwd: workDir,
            stdout: "pipe",
            stderr: "pipe",
            signal: AbortSignal.timeout(timeout),
          })
          const stdout = await new Response(proc.stdout).text()
          const stderr = await new Response(proc.stderr).text()
          const exitCode = await proc.exited
          return { stdout, stderr, exitCode }
        },
      },
      search: {
        async grep(pattern: string, searchPath: string): Promise<Array<{ file: string; line: number; content: string }>> {
          const resolved = path.resolve(workDir, searchPath)
          const results: Array<{ file: string; line: number; content: string }> = []
          try {
            const proc = Bun.spawn(["grep", "-rn", pattern, resolved], { stdout: "pipe", stderr: "pipe" })
            const output = await new Response(proc.stdout).text()
            for (const line of output.split("\n")) {
              const match = line.match(/^(.+?):(\d+):(.+)$/)
              if (match) {
                results.push({ file: match[1], line: parseInt(match[2]), content: match[3].trim() })
              }
            }
          } catch {}
          return results
        },
        async glob(pattern: string, searchPath: string): Promise<string[]> {
          const resolved = path.resolve(workDir, searchPath)
          const proc = Bun.spawn(["find", resolved, "-name", pattern, "-type", "f"], { stdout: "pipe", stderr: "pipe" })
          const output = await new Response(proc.stdout).text()
          return output.split("\n").filter(Boolean)
        },
        async findDefinition(symbol: string): Promise<Array<{ file: string; line: number; kind: string }>> {
          const patterns = [
            `(?:function|class|type|interface|enum|const|let|var)\\s+${symbol}\\b`,
            `(?:export|public|private|protected)\\s+(?:async\\s+)?(?:function|class)\\s+${symbol}\\b`,
          ]
          const results: Array<{ file: string; line: number; kind: string }> = []
          for (const pattern of patterns) {
            const grepResults = await context.search.grep(pattern, ".")
            for (const r of grepResults) {
              const kindMatch = r.content.match(/(function|class|type|interface|enum|const)/)
              results.push({ file: r.file, line: r.line, kind: kindMatch?.[1] ?? "unknown" })
            }
          }
          return results
        },
        async findReferences(symbol: string): Promise<Array<{ file: string; line: number; content: string }>> {
          return context.search.grep(`\\b${symbol}\\b`, ".")
        },
      },
    }
    return context
  }

  private registerBuiltinCommands(): void {
    this.registerCommand({
      name: "read",
      description: "Read a file's contents",
      usage: "read <path>",
      execute: async (args, ctx) => {
        if (args.length === 0) return { output: "Usage: read <path>", success: false }
        try {
          const content = await ctx.fileSystem.readFile(args[0])
          return { output: content, success: true }
        } catch (e) {
          return { output: `Error reading file: ${e}`, success: false }
        }
      },
    })

    this.registerCommand({
      name: "write",
      description: "Write content to a file",
      usage: "write <path> <content>",
      execute: async (args, ctx) => {
        if (args.length < 2) return { output: "Usage: write <path> <content>", success: false }
        try {
          await ctx.fileSystem.writeFile(args[0], args.slice(1).join(" "))
          return { output: `Written to ${args[0]}`, success: true }
        } catch (e) {
          return { output: `Error writing file: ${e}`, success: false }
        }
      },
    })

    this.registerCommand({
      name: "ls",
      description: "List directory contents",
      usage: "ls [path]",
      execute: async (args, ctx) => {
        const dir = args[0] || "."
        try {
          const entries = await ctx.fileSystem.listDir(dir)
          return { output: entries.join("\n"), success: true }
        } catch (e) {
          return { output: `Error listing directory: ${e}`, success: false }
        }
      },
    })

    this.registerCommand({
      name: "bash",
      description: "Execute a shell command",
      usage: "bash <command>",
      execute: async (args, ctx) => {
        const command = args.join(" ")
        try {
          const result = await ctx.shell.exec(command)
          const output = result.stdout + (result.stderr ? `\nSTDERR:\n${result.stderr}` : "")
          return { output: output || "(no output)", success: result.exitCode === 0, metadata: { exitCode: result.exitCode } }
        } catch (e) {
          return { output: `Error executing command: ${e}`, success: false }
        }
      },
    })

    this.registerCommand({
      name: "grep",
      description: "Search for patterns in files",
      usage: "grep <pattern> [path]",
      execute: async (args, ctx) => {
        if (args.length === 0) return { output: "Usage: grep <pattern> [path]", success: false }
        const results = await ctx.search.grep(args[0], args[1] || ".")
        const output = results.map((r) => `${r.file}:${r.line}: ${r.content}`).join("\n")
        return { output: output || "No matches found", success: true, metadata: { matchCount: results.length } }
      },
    })

    this.registerCommand({
      name: "find-def",
      description: "Find definition of a symbol",
      usage: "find-def <symbol>",
      execute: async (args, ctx) => {
        if (args.length === 0) return { output: "Usage: find-def <symbol>", success: false }
        const results = await ctx.search.findDefinition(args[0])
        const output = results.map((r) => `${r.file}:${r.line} (${r.kind})`).join("\n")
        return { output: output || "No definition found", success: true }
      },
    })

    this.registerCommand({
      name: "find-refs",
      description: "Find references to a symbol",
      usage: "find-refs <symbol>",
      execute: async (args, ctx) => {
        if (args.length === 0) return { output: "Usage: find-refs <symbol>", success: false }
        const results = await ctx.search.findReferences(args[0])
        const output = results.map((r) => `${r.file}:${r.line}: ${r.content}`).join("\n")
        return { output: output || "No references found", success: true }
      },
    })

    this.registerCommand({
      name: "diff",
      description: "Show diff between two files or git diff",
      usage: "diff [file1] [file2]",
      execute: async (args, ctx) => {
        if (args.length === 0) {
          const result = await ctx.shell.exec("git diff")
          return { output: result.stdout || "(no changes)", success: true }
        }
        if (args.length === 1) {
          const result = await ctx.shell.exec(`git diff ${args[0]}`)
          return { output: result.stdout || "(no changes)", success: true }
        }
        const result = await ctx.shell.exec(`diff ${args[0]} ${args[1]}`)
        return { output: result.stdout || "(files are identical)", success: true }
      },
    })

    this.registerCommand({
      name: "git",
      description: "Execute git commands",
      usage: "git <args>",
      execute: async (args, ctx) => {
        const result = await ctx.shell.exec(`git ${args.join(" ")}`)
        return { output: result.stdout + result.stderr, success: result.exitCode === 0 }
      },
    })

    this.registerCommand({
      name: "context",
      description: "Get context about a file or symbol",
      usage: "context <file_or_symbol>",
      execute: async (args, ctx) => {
        if (args.length === 0) return { output: "Usage: context <file_or_symbol>", success: false }
        const target = args[0]
        const lines: string[] = []

        if (await ctx.fileSystem.exists(target)) {
          const content = await ctx.fileSystem.readFile(target)
          const stat = await ctx.fileSystem.stat(target)
          lines.push(`File: ${target}`)
          lines.push(`Size: ${stat.size} bytes`)
          lines.push(`Lines: ${content.split("\n").length}`)
          lines.push("")
          lines.push(content.slice(0, 2000))
          if (content.length > 2000) lines.push("\n... (truncated)")
        } else {
          const defs = await ctx.search.findDefinition(target)
          if (defs.length > 0) {
            lines.push(`Definition of ${target}:`)
            for (const def of defs) {
              lines.push(`  ${def.file}:${def.line} (${def.kind})`)
              const content = await ctx.fileSystem.readFile(def.file)
              const line = content.split("\n")[def.line - 1]
              if (line) lines.push(`  ${line.trim()}`)
            }
          }
          const refs = await ctx.search.findReferences(target)
          if (refs.length > 0) {
            lines.push(`\nReferences (${refs.length}):`)
            for (const ref of refs.slice(0, 10)) {
              lines.push(`  ${ref.file}:${ref.line}: ${ref.content}`)
            }
          }
        }

        return { output: lines.join("\n") || "No context found", success: true }
      },
    })
  }

  registerCommand(command: ACICommand): void {
    this.commands.set(command.name, command)
  }

  async execute(input: string): Promise<ACIResult> {
    const parts = input.trim().split(/\s+/)
    const cmdName = parts[0]
    const args = parts.slice(1)

    const command = this.commands.get(cmdName)
    if (!command) {
      return { output: `Unknown command: ${cmdName}. Available: ${Array.from(this.commands.keys()).join(", ")}`, success: false }
    }

    const start = Date.now()
    const result = await command.execute(args, this.context)
    const duration = Date.now() - start

    this.history.push({ command: cmdName, args, result, timestamp: Date.now() })
    log.info(`ACI command ${cmdName} completed in ${duration}ms: ${result.success ? "OK" : "FAIL"}`)

    return result
  }

  getHistory(): Array<{ command: string; args: string[]; result: ACIResult; timestamp: number }> {
    return [...this.history]
  }

  getCommands(): ACICommand[] {
    return Array.from(this.commands.values())
  }

  getCommand(name: string): ACICommand | undefined {
    return this.commands.get(name)
  }
}
