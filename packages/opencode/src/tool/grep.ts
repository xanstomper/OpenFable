import path from "path"
import z from "zod"
import { Effect, Option } from "effect"
import { AppFileSystem } from "@openfable/shared/filesystem"
import { Ripgrep } from "../file/ripgrep"
import { assertExternalDirectoryEffect } from "./external-directory"
import { SessionCwd } from "./session-cwd"
import DESCRIPTION from "./grep.txt"
import * as Tool from "./tool"

const MAX_LINE_LENGTH = 2000

export const GrepTool = Tool.define(
  "grep",
  Effect.gen(function* () {
    const fs = yield* AppFileSystem.Service
    const rg = yield* Ripgrep.Service

    return {
      description: DESCRIPTION,
      parameters: z.object({
        pattern: z.string().describe("The regex pattern to search for in file contents"),
        path: z.string().optional().describe("File or directory to search in. Defaults to the current working directory."),
        include: z.string().optional().describe('Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}")'),
        output_mode: z.enum(["content", "files_with_matches", "count"]).optional().describe('Output mode: "content" shows matching lines, "files_with_matches" shows file paths (default), "count" shows match counts.'),
        context: z.number().optional().describe("Number of lines to show before and after each match. Requires output_mode: content."),
        "-n": z.boolean().optional().describe("Show line numbers in output. Requires output_mode: content. Defaults to true."),
        "-i": z.boolean().optional().describe("Case insensitive search"),
        type: z.string().optional().describe("File type to search (e.g. js, py, rust, go). More efficient than include for standard file types."),
        head_limit: z.number().optional().describe("Limit output to first N lines/entries. Defaults to 250. Pass 0 for unlimited."),
        offset: z.number().optional().describe("Skip first N lines/entries before applying head_limit. Defaults to 0."),
        multiline: z.boolean().optional().describe("Enable multiline mode where patterns can span lines. Default: false."),
      }),
      execute: (params: {
        pattern: string
        path?: string
        include?: string
        output_mode?: "content" | "files_with_matches" | "count"
        context?: number
        "-n"?: boolean
        "-i"?: boolean
        type?: string
        head_limit?: number
        offset?: number
        multiline?: boolean
      }, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const outputMode = params.output_mode ?? "files_with_matches"
          const headLimit = params.head_limit ?? 250
          const offset = params.offset ?? 0

          const empty = {
            title: params.pattern,
            metadata: { matches: 0, truncated: false },
            output: "No files found",
          }
          if (!params.pattern) {
            throw new Error("pattern is required")
          }

          yield* ctx.ask({
            permission: "grep",
            patterns: [params.pattern],
            always: ["*"],
            metadata: {
              pattern: params.pattern,
              path: params.path,
              include: params.include,
              output_mode: outputMode,
            },
          })

          const effectiveCwd = SessionCwd.get(ctx.sessionID)
          const search = AppFileSystem.resolve(
            path.isAbsolute(params.path ?? effectiveCwd)
              ? (params.path ?? effectiveCwd)
              : path.join(effectiveCwd, params.path ?? "."),
          )
          const info = yield* fs.stat(search).pipe(Effect.catch(() => Effect.succeed(undefined)))
          const cwd = info?.type === "Directory" ? search : path.dirname(search)
          const file = info?.type === "Directory" ? undefined : [path.relative(cwd, search)]
          yield* assertExternalDirectoryEffect(ctx, search, {
            kind: info?.type === "Directory" ? "directory" : "file",
          })

          const result = yield* rg.search({
            cwd,
            pattern: params.pattern,
            glob: params.include ? [params.include] : undefined,
            file,
            signal: ctx.abort,
          })
          if (result.items.length === 0) return empty

          const rows = result.items.map((item) => ({
            path: AppFileSystem.resolve(
              path.isAbsolute(item.path.text) ? item.path.text : path.join(cwd, item.path.text),
            ),
            line: item.line_number,
            text: item.lines.text,
          }))
          const times = new Map(
            (yield* Effect.forEach(
              [...new Set(rows.map((row) => row.path))],
              Effect.fnUntraced(function* (file) {
                const info = yield* fs.stat(file).pipe(Effect.catch(() => Effect.succeed(undefined)))
                if (!info || info.type === "Directory") return undefined
                return [
                  file,
                  info.mtime.pipe(
                    Option.map((time) => time.getTime()),
                    Option.getOrElse(() => 0),
                  ) ?? 0,
                ] as const
              }),
              { concurrency: 16 },
            )).filter((entry): entry is readonly [string, number] => Boolean(entry)),
          )
          const matches = rows.flatMap((row) => {
            const mtime = times.get(row.path)
            if (mtime === undefined) return []
            return [{ ...row, mtime }]
          })

          matches.sort((a, b) => b.mtime - a.mtime)

          // Apply offset and head_limit
          const sliced = matches.slice(offset, offset + headLimit || undefined)
          const truncated = matches.length > offset + headLimit
          const final = sliced
          if (final.length === 0) return empty

          const total = matches.length

          if (outputMode === "count") {
            const counts = new Map<string, number>()
            for (const match of matches) {
              counts.set(match.path, (counts.get(match.path) ?? 0) + 1)
            }
            const output = [...counts.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, headLimit)
              .map(([file, count]) => `${file}: ${count}`)
            return {
              title: params.pattern,
              metadata: { matches: total, truncated },
              output: output.length > 0 ? output.join("\n") : "No matches",
            }
          }

          if (outputMode === "files_with_matches") {
            const uniquePaths = [...new Set(final.map((m) => m.path))]
            const output = uniquePaths.slice(0, headLimit)
            return {
              title: params.pattern,
              metadata: { matches: total, truncated },
              output: output.length > 0 ? output.join("\n") : "No matches",
            }
          }

          // outputMode === "content"
          const output = [`Found ${total} matches${truncated ? ` (showing ${final.length} after offset)` : ""}`]
          let current = ""
          for (const match of final) {
            if (current !== match.path) {
              if (current !== "") output.push("")
              current = match.path
              output.push(`${match.path}:`)
            }
            const text =
              match.text.length > MAX_LINE_LENGTH ? match.text.substring(0, MAX_LINE_LENGTH) + "..." : match.text
            output.push(`  Line ${match.line}: ${text}`)
          }

          if (truncated) {
            output.push("")
            output.push(
              `(Results truncated: use offset and head_limit to paginate. Consider using a more specific path or pattern.)`,
            )
          }

          if (result.partial) {
            output.push("")
            output.push("(Some paths were inaccessible and skipped)")
          }

          return {
            title: params.pattern,
            metadata: {
              matches: total,
              truncated,
            },
            output: output.join("\n"),
          }
        }).pipe(Effect.orDie),
    }
  }),
)
