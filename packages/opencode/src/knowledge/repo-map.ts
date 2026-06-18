import { Database } from "@/storage"
import { Log } from "@/util"
import path from "path"
import fs from "fs"

const log = Log.create({ service: "repo-map" })

export interface RepoSymbol {
  id: string
  name: string
  kind: "function" | "class" | "method" | "type" | "interface" | "enum" | "const" | "variable" | "module" | "export"
  filePath: string
  startLine: number
  endLine: number
  signature: string
  docstring: string
  imports: string[]
  exports: string[]
  calls: string[]
  extends: string[]
  implements: string[]
  hash: string
  lastIndexed: number
}

export interface RepoFile {
  path: string
  language: string
  hash: string
  symbols: string[]
  imports: string[]
  exports: string[]
  lines: number
  lastIndexed: number
}

export interface RepoMapOptions {
  root: string
  excludePatterns: string[]
  maxFileSize: number
  indexInterval: number
  pagerankDamping: number
  pagerankIterations: number
  personalizationWeight: number
  tokenBudget: number
  tokensPerLine: number
}

const DEFAULT_OPTIONS: RepoMapOptions = {
  root: process.cwd(),
  excludePatterns: [
    "node_modules",
    ".git",
    "dist",
    "build",
    "__pycache__",
    ".next",
    "target",
    "vendor",
    ".cache",
  ],
  maxFileSize: 100_000,
  indexInterval: 60_000,
  pagerankDamping: 0.85,
  pagerankIterations: 50,
  personalizationWeight: 0.3,
  tokenBudget: 10_000,
  tokensPerLine: 4,
}

interface DirectedEdge {
  from: string
  to: string
  weight: number
}

export interface PageRankResult {
  scores: Map<string, number>
  iterations: number
  converged: boolean
}

export class RepoMap {
  private db: ReturnType<typeof Database.Client>
  private options: RepoMapOptions
  private lastIndex: number = 0

  constructor(options?: Partial<RepoMapOptions>) {
    this.db = Database.Client()
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.ensureSchema()
  }

  private ensureSchema(): void {
    this.db.$client.run(`
      CREATE TABLE IF NOT EXISTS repo_symbols (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        file_path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        signature TEXT NOT NULL DEFAULT '',
        docstring TEXT NOT NULL DEFAULT '',
        imports TEXT NOT NULL DEFAULT '[]',
        exports TEXT NOT NULL DEFAULT '[]',
        calls TEXT NOT NULL DEFAULT '[]',
        extends TEXT NOT NULL DEFAULT '[]',
        implements TEXT NOT NULL DEFAULT '[]',
        hash TEXT NOT NULL,
        last_indexed INTEGER NOT NULL
      )
    `)
    this.db.$client.run(`
      CREATE INDEX IF NOT EXISTS idx_repo_sym_name ON repo_symbols(name)
    `)
    this.db.$client.run(`
      CREATE INDEX IF NOT EXISTS idx_repo_sym_file ON repo_symbols(file_path)
    `)
    this.db.$client.run(`
      CREATE TABLE IF NOT EXISTS repo_files (
        path TEXT PRIMARY KEY,
        language TEXT NOT NULL,
        hash TEXT NOT NULL,
        symbols TEXT NOT NULL DEFAULT '[]',
        imports TEXT NOT NULL DEFAULT '[]',
        exports TEXT NOT NULL DEFAULT '[]',
        lines INTEGER NOT NULL DEFAULT 0,
        last_indexed INTEGER NOT NULL
      )
    `)
    this.db.$client.run(`
      CREATE TABLE IF NOT EXISTS repo_pagerank (
        file_path TEXT PRIMARY KEY,
        score REAL NOT NULL,
        computed_at INTEGER NOT NULL
      )
    `)
  }

  async indexFull(): Promise<{ files: number; symbols: number }> {
    const startTime = Date.now()
    log.info("Starting full repo-map index...")

    const files = await this.walkDir(this.options.root)
    let fileCount = 0
    let symbolCount = 0

    for (const filePath of files) {
      const result = await this.indexFile(filePath)
      if (result) {
        fileCount++
        symbolCount += result.symbols
      }
    }

    this.lastIndex = Date.now()
    log.info(`Repo-map index complete: ${fileCount} files, ${symbolCount} symbols in ${Date.now() - startTime}ms`)
    return { files: fileCount, symbols: symbolCount }
  }

  async indexFile(filePath: string): Promise<{ symbols: number } | null> {
    try {
      const stat = await fs.promises.stat(filePath)
      if (stat.size > this.options.maxFileSize) return null

      const content = await fs.promises.readFile(filePath, "utf-8")
      const hash = this.hashContent(content)
      const existing = this.getFileByPath(filePath)
      if (existing && existing.hash === hash) return null

      const ext = path.extname(filePath)
      const language = this.detectLanguage(ext)
      const symbols = this.extractSymbols(content, filePath, language)
      const imports = this.extractImports(content, language)
      const exports = this.extractExports(content, language)
      const lines = content.split("\n").length

      const file: RepoFile = {
        path: filePath,
        language,
        hash,
        symbols: symbols.map((s) => s.id),
        imports,
        exports,
        lines,
        lastIndexed: Date.now(),
      }

      this.upsertFile(file)
      for (const symbol of symbols) {
        this.upsertSymbol(symbol)
      }

      return { symbols: symbols.length }
    } catch {
      return null
    }
  }

  search(query: string, limit: number = 20): RepoSymbol[] {
    const rows = this.db.$client
      .query(
        `SELECT * FROM repo_symbols
         WHERE name LIKE ? OR signature LIKE ? OR docstring LIKE ?
         ORDER BY
           CASE WHEN name LIKE ? THEN 0 ELSE 1 END,
           length(name)
         LIMIT ?`,
      )
      .all(`%${query}%`, `%${query}%`, `%${query}%`, `${query}%`, limit) as any[]
    return rows.map((r) => this.rowToSymbol(r))
  }

  getCallGraph(symbolId: string): { calls: RepoSymbol[]; calledBy: RepoSymbol[] } {
    const symbol = this.getSymbolById(symbolId)
    if (!symbol) return { calls: [], calledBy: [] }

    const callIds = JSON.parse(symbol.calls as any || "[]")
    const calls = callIds.map((id: string) => this.getSymbolById(id)).filter(Boolean) as RepoSymbol[]

    const callerRows = this.db.$client
      .query(`SELECT * FROM repo_symbols WHERE calls LIKE ?`)
      .all(`%${symbolId}%`) as any[]
    const calledBy = callerRows.map((r) => this.rowToSymbol(r))

    return { calls, calledBy }
  }

  getFileTree(): string {
    const files = this.db.$client.query(`SELECT path, language FROM repo_files ORDER BY path`).all() as any[]
    const tree: string[] = []
    let currentDir = ""

    for (const file of files) {
      const dir = path.dirname(file.path)
      if (dir !== currentDir) {
        currentDir = dir
        tree.push(`\n${dir}/`)
      }
      tree.push(`  ${path.basename(file.path)} (${file.language})`)
    }

    return tree.join("\n")
  }

  getSymbolContext(symbolName: string): string {
    const symbols = this.search(symbolName, 5)
    if (symbols.length === 0) return ""

    const lines: string[] = []
    for (const sym of symbols) {
      lines.push(`## ${sym.name} (${sym.kind})`)
      lines.push(`File: ${sym.filePath}:${sym.startLine}-${sym.endLine}`)
      if (sym.signature) lines.push(`Signature: ${sym.signature}`)
      if (sym.docstring) lines.push(`Doc: ${sym.docstring}`)
      if (sym.extends.length > 0) lines.push(`Extends: ${sym.extends.join(", ")}`)
      if (sym.implements.length > 0) lines.push(`Implements: ${sym.implements.join(", ")}`)
      lines.push("")
    }

    return lines.join("\n")
  }

  async getChangedFiles(): Promise<string[]> {
    const rows = this.db.$client
      .query(`SELECT path, hash FROM repo_files`)
      .all() as any[]

    const changed: string[] = []
    for (const row of rows) {
      try {
        const content = await fs.promises.readFile(row.path, "utf-8")
        const currentHash = this.hashContent(content)
        if (currentHash !== row.hash) {
          changed.push(row.path)
        }
      } catch {
        changed.push(row.path)
      }
    }
    return changed
  }

  // --- Aider-inspired PageRank and identity heuristics ---

  computeFileImportance(personalizeFiles?: string[]): Map<string, number> {
    const cached = this.loadCachedPageRank()
    if (cached && !personalizeFiles?.length) return cached

    const edges = this.buildEdgeGraph()
    const allNodes = this.collectAllNodes(edges)
    const personalization = this.buildPersonalization(personalizeFiles ?? [])

    const result = this.runPageRank(allNodes, edges, personalization)

    this.persistPageRank(result.scores)
    return result.scores
  }

  private loadCachedPageRank(): Map<string, number> | null {
    const rows = this.db.$client
      .query(`SELECT file_path, score FROM repo_pagerank`)
      .all() as any[]
    if (rows.length === 0) return null
    const map = new Map<string, number>()
    for (const row of rows) map.set(row.file_path, row.score)
    return map
  }

  private persistPageRank(scores: Map<string, number>): void {
    this.db.$client.run(`DELETE FROM repo_pagerank`)
    const now = Date.now()
    const stmt = this.db.$client.prepare(
      `INSERT INTO repo_pagerank (file_path, score, computed_at) VALUES (?, ?, ?)`,
    )
    for (const [filePath, score] of scores) {
      stmt.run(filePath, score, now)
    }
  }

  private buildEdgeGraph(): DirectedEdge[] {
    const files = this.db.$client
      .query(`SELECT path, imports, exports, symbols FROM repo_files`)
      .all() as any[]
    const symbols = this.db.$client
      .query(`SELECT id, file_path, calls, extends, implements, name FROM repo_symbols`)
      .all() as any[]

    const edges: DirectedEdge[] = []
    const symbolToFile = new Map<string, string>()
    for (const sym of symbols) symbolToFile.set(sym.id, sym.file_path)

    for (const file of files) {
      const sourcePath = file.path
      const imports: string[] = JSON.parse(file.imports || "[]")
      const fileSymbolIds: string[] = JSON.parse(file.symbols || "[]")

      for (const imp of imports) {
        const targetFile = this.resolveImportToFilePath(imp, sourcePath)
        if (targetFile && targetFile !== sourcePath) {
          edges.push({ from: sourcePath, to: targetFile, weight: this.identityEdgeWeight(imp) })
        }
      }

      for (const symId of fileSymbolIds) {
        const sym = symbols.find((s: any) => s.id === symId)
        if (!sym) continue

        const callIds: string[] = JSON.parse(sym.calls || "[]")
        for (const callId of callIds) {
          const targetFile = symbolToFile.get(callId)
          if (targetFile && targetFile !== sourcePath) {
            edges.push({ from: sourcePath, to: targetFile, weight: 1.0 })
          }
        }

        const extIds: string[] = JSON.parse(sym.extends || "[]")
        for (const extId of extIds) {
          const targetFile = symbolToFile.get(extId)
          if (targetFile && targetFile !== sourcePath) {
            edges.push({ from: sourcePath, to: targetFile, weight: 2.0 })
          }
        }

        const implIds: string[] = JSON.parse(sym.implements || "[]")
        for (const implId of implIds) {
          const targetFile = symbolToFile.get(implId)
          if (targetFile && targetFile !== sourcePath) {
            edges.push({ from: sourcePath, to: targetFile, weight: 1.5 })
          }
        }
      }
    }

    return edges
  }

  private collectAllNodes(edges: DirectedEdge[]): string[] {
    const nodes = new Set<string>()
    for (const e of edges) {
      nodes.add(e.from)
      nodes.add(e.to)
    }
    const allFiles = this.db.$client.query(`SELECT path FROM repo_files`).all() as any[]
    for (const f of allFiles) nodes.add(f.path)
    return [...nodes]
  }

  private identityEdgeWeight(name: string): number {
    if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) return 10
    if (/^[a-z][a-z0-9]*([A-Z][a-z0-9]+)+$/.test(name)) return 10
    if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name)) return 10
    if (/^_[a-zA-Z0-9_]+$/.test(name) || /^\.[a-z]+$/.test(name)) return 0.1
    if (/^__\w+__$/.test(name)) return 0.1
    return 1.0
  }

  private buildPersonalization(files: string[]): Map<string, number> {
    const pers = new Map<string, number>()
    if (files.length === 0) return pers
    const weight = 1.0 / files.length
    for (const f of files) pers.set(path.resolve(this.options.root, f), weight)
    return pers
  }

  private runPageRank(
    nodes: string[],
    edges: DirectedEdge[],
    personalization: Map<string, number>,
  ): PageRankResult {
    const d = this.options.pagerankDamping
    const maxIter = this.options.pagerankIterations
    const persWeight = this.options.personalizationWeight
    const hasPersonalization = personalization.size > 0

    const outWeights = new Map<string, number>()
    const inEdges = new Map<string, Array<{ from: string; weight: number }>>()
    for (const n of nodes) {
      outWeights.set(n, 0)
      inEdges.set(n, [])
    }

    for (const e of edges) {
      outWeights.set(e.from, (outWeights.get(e.from) ?? 0) + e.weight)
      inEdges.get(e.to)?.push({ from: e.from, weight: e.weight })
    }

    const n = nodes.length
    let scores = new Map<string, number>()
    const baseScore = 1.0 / n
    for (const node of nodes) scores.set(node, baseScore)

    let converged = false
    let iter = 0

    for (iter = 0; iter < maxIter; iter++) {
      const next = new Map<string, number>()
      let diff = 0

      for (const node of nodes) {
        let incomingScore = 0
        for (const edge of inEdges.get(node) ?? []) {
          const srcOut = outWeights.get(edge.from) ?? 1
          incomingScore += (scores.get(edge.from) ?? baseScore) * (edge.weight / srcOut)
        }

        const baseContrib = (1 - d) / n
        const persContrib = hasPersonalization
          ? persWeight * (personalization.get(node) ?? 0)
          : 0
        const linkContrib = d * incomingScore
        const newScore = baseContrib + persContrib + linkContrib
        next.set(node, newScore)
        diff += Math.abs(newScore - (scores.get(node) ?? baseScore))
      }

      scores = next
      if (diff < 1e-6) {
        converged = true
        break
      }
    }

    return { scores, iterations: iter, converged }
  }

  private resolveImportToFilePath(importPath: string, fromFile: string): string | null {
    if (importPath.startsWith(".")) {
      const dir = path.dirname(fromFile)
      const candidates = [
        path.resolve(dir, importPath),
        path.resolve(dir, importPath + ".ts"),
        path.resolve(dir, importPath + ".tsx"),
        path.resolve(dir, importPath + ".js"),
        path.resolve(dir, importPath + ".jsx"),
        path.resolve(dir, importPath, "index.ts"),
        path.resolve(dir, importPath, "index.tsx"),
        path.resolve(dir, importPath, "index.js"),
      ]
      for (const c of candidates) {
        const row = this.db.$client.query(`SELECT path FROM repo_files WHERE path = ?`).get(c) as any
        if (row) return row.path
      }
      return null
    }

    const rows = this.db.$client.query(`SELECT path FROM repo_files`).all() as any[]
    const basename = path.basename(importPath)
    for (const row of rows) {
      if (path.basename(row.path) === basename || row.path.endsWith("/" + importPath)) {
        return row.path
      }
    }
    return null
  }

  // --- Token budget fitting with binary search ---

  fitToTokenBudget(
    budget: number = this.options.tokenBudget,
    personalizationWeight: number = this.options.personalizationWeight,
  ): { tree: string; filesIncluded: number; symbolsIncluded: number; tokensUsed: number } {
    const importance = this.computeFileImportance()
    const ranked = [...importance.entries()].sort((a, b) => b[1] - a[1])

    let low = 0
    let high = ranked.length
    let bestResult: { tree: string; filesIncluded: number; symbolsIncluded: number; tokensUsed: number } | null = null

    while (low <= high) {
      const mid = (low + high) >> 1
      const topFiles = ranked.slice(0, mid).map(([p]) => p)
      const rendered = this.renderCondensedTree(topFiles, importance)
      const tokens = this.estimateTokens(rendered)

      if (tokens <= budget) {
        bestResult = {
          tree: rendered,
          filesIncluded: mid,
          symbolsIncluded: this.countSymbolsInTree(rendered),
          tokensUsed: tokens,
        }
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    return bestResult ?? {
      tree: "",
      filesIncluded: 0,
      symbolsIncluded: 0,
      tokensUsed: 0,
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.split("\n").length * this.options.tokensPerLine)
  }

  private countSymbolsInTree(tree: string): number {
    return (tree.match(/^  \w+/gm) || []).length
  }

  // --- Condensed tree rendering ---

  renderCondensedTree(
    filePaths: string[],
    importance?: Map<string, number>,
  ): string {
    const lines: string[] = []
    const byDir = new Map<string, Array<{ file: string; name: string }>>()

    for (const fp of filePaths) {
      const dir = path.dirname(fp)
      const name = path.basename(fp)
      const existing = byDir.get(dir) ?? []
      existing.push({ file: fp, name })
      byDir.set(dir, existing)
    }

    const sortedDirs = [...byDir.keys()].sort()
    for (const dir of sortedDirs) {
      const files = byDir.get(dir)!.sort((a, b) => a.name.localeCompare(b.name))
      lines.push(`${dir}/`)

      for (const { file, name } of files) {
        const score = importance?.get(file)
        const scoreStr = score != null ? ` [${score.toFixed(3)}]` : ""
        const symbols = this.getFileSymbolsForTree(file)

        if (symbols.length === 0) {
          lines.push(`  ${name}${scoreStr}`)
          continue
        }

        lines.push(`  ${name}${scoreStr}`)
        for (const sym of symbols) {
          lines.push(`    ${sym.kind} ${sym.name}${sym.signature ? `(${sym.signature})` : ""}`)
        }
      }
      lines.push("")
    }

    return lines.join("\n")
  }

  private getFileSymbolsForTree(filePath: string): Array<{ name: string; kind: string; signature: string }> {
    const row = this.db.$client.query(`SELECT symbols FROM repo_files WHERE path = ?`).get(filePath) as any
    if (!row) return []

    const symbolIds: string[] = JSON.parse(row.symbols || "[]")
    const results: Array<{ name: string; kind: string; signature: string }> = []

    for (const id of symbolIds) {
      const sym = this.db.$client.query(`SELECT name, kind, signature FROM repo_symbols WHERE id = ?`).get(id) as any
      if (sym) results.push({ name: sym.name, kind: sym.kind, signature: sym.signature })
    }

    return results
  }

  // --- Personalized tree for working set ---

  getPersonalizedTree(
    workingFiles: string[],
    budget: number = this.options.tokenBudget,
  ): string {
    const importance = this.computeFileImportance(workingFiles)
    const ranked = [...importance.entries()].sort((a, b) => b[1] - a[1])

    const workingSet = new Set(workingFiles.map((f) => path.resolve(this.options.root, f)))
    const prioritized = ranked.filter(([fp]) => workingSet.has(fp))
    const rest = ranked.filter(([fp]) => !workingSet.has(fp))

    const allRanked = [...prioritized, ...rest]

    let low = 0
    let high = allRanked.length
    let best: string[] = []

    while (low <= high) {
      const mid = (low + high) >> 1
      const topFiles = allRanked.slice(0, mid).map(([p]) => p)
      const rendered = this.renderCondensedTree(topFiles, importance)
      if (this.estimateTokens(rendered) <= budget) {
        best = topFiles
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    return this.renderCondensedTree(best, importance)
  }

  // --- Helper methods ---

  private extractSymbols(content: string, filePath: string, language: string): RepoSymbol[] {
    const symbols: RepoSymbol[] = []
    const lines = content.split("\n")

    const patterns = this.getSymbolPatterns(language)
    for (let i = 0; i < lines.length; i++) {
      for (const pattern of patterns) {
        const match = lines[i].match(pattern.regex)
        if (match) {
          const name = match[pattern.nameGroup]
          const sig = match[pattern.sigGroup] || ""
          const doc = this.extractDocstring(lines, i)
          const endLine = this.findBlockEnd(lines, i)

          symbols.push({
            id: `sym_${language}_${name}_${filePath.replace(/[^a-zA-Z0-9]/g, "_")}_${i}`,
            name,
            kind: pattern.kind,
            filePath,
            startLine: i + 1,
            endLine: endLine,
            signature: sig,
            docstring: doc,
            imports: [],
            exports: [],
            calls: [],
            extends: [],
            implements: [],
            hash: this.hashContent(lines.slice(i, endLine).join("\n")),
            lastIndexed: Date.now(),
          })
        }
      }
    }
    return symbols
  }

  private getSymbolPatterns(language: string): Array<{
    regex: RegExp
    kind: RepoSymbol["kind"]
    nameGroup: number
    sigGroup: number
  }> {
    switch (language) {
      case "typescript":
      case "javascript":
        return [
          { regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/, kind: "function", nameGroup: 1, sigGroup: 2 },
          { regex: /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/, kind: "class", nameGroup: 1, sigGroup: 2 },
          { regex: /(?:export\s+)?(?:type|interface)\s+(\w+)/, kind: "type", nameGroup: 1, sigGroup: 0 },
          { regex: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*([^=]+))?/, kind: "const", nameGroup: 1, sigGroup: 2 },
          { regex: /(?:export\s+)?enum\s+(\w+)/, kind: "enum", nameGroup: 1, sigGroup: 0 },
        ]
      case "python":
        return [
          { regex: /def\s+(\w+)\s*\(([^)]*)\)/, kind: "function", nameGroup: 1, sigGroup: 2 },
          { regex: /class\s+(\w+)(?:\(([^)]*)\))?:/, kind: "class", nameGroup: 1, sigGroup: 2 },
          { regex: /(\w+)\s*=\s*(?:lambda|function)/, kind: "function", nameGroup: 1, sigGroup: 0 },
        ]
      case "rust":
        return [
          { regex: /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)\s*\(([^)]*)\)/, kind: "function", nameGroup: 1, sigGroup: 2 },
          { regex: /(?:pub\s+)?struct\s+(\w+)/, kind: "class", nameGroup: 1, sigGroup: 0 },
          { regex: /(?:pub\s+)?enum\s+(\w+)/, kind: "enum", nameGroup: 1, sigGroup: 0 },
          { regex: /(?:pub\s+)?trait\s+(\w+)/, kind: "interface", nameGroup: 1, sigGroup: 0 },
          { regex: /(?:pub\s+)?type\s+(\w+)/, kind: "type", nameGroup: 1, sigGroup: 0 },
        ]
      case "go":
        return [
          { regex: /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(([^)]*)\)/, kind: "function", nameGroup: 1, sigGroup: 2 },
          { regex: /type\s+(\w+)\s+struct/, kind: "class", nameGroup: 1, sigGroup: 0 },
          { regex: /type\s+(\w+)\s+interface/, kind: "interface", nameGroup: 1, sigGroup: 0 },
        ]
      default:
        return [
          { regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/, kind: "function", nameGroup: 1, sigGroup: 2 },
          { regex: /(?:export\s+)?class\s+(\w+)/, kind: "class", nameGroup: 1, sigGroup: 0 },
        ]
    }
  }

  private extractImports(content: string, language: string): string[] {
    const imports: string[] = []
    const lines = content.split("\n")
    for (const line of lines) {
      const match = line.match(/import\s+(?:.*from\s+)?["']([^"']+)["']/)
      if (match) imports.push(match[1])
    }
    return imports
  }

  private extractExports(content: string, language: string): string[] {
    const exports: string[] = []
    const lines = content.split("\n")
    for (const line of lines) {
      const match = line.match(/export\s+(?:default\s+)?(?:function|class|const|let|var|type|interface)\s+(\w+)/)
      if (match) exports.push(match[1])
    }
    return exports
  }

  private extractDocstring(lines: string[], lineIndex: number): string {
    for (let i = lineIndex - 1; i >= 0; i--) {
      const line = lines[i].trim()
      if (line.startsWith("/**") || line.startsWith("///") || line.startsWith("#")) {
        const docLines: string[] = []
        for (let j = i; j < lineIndex; j++) {
          const l = lines[j].trim().replace(/^(\/\*\*|\/\/\/|\*|#)\s?/, "").replace(/\*\/$/, "")
          if (l) docLines.push(l)
        }
        return docLines.join(" ")
      }
      if (line && !line.startsWith("//") && !line.startsWith("*")) break
    }
    return ""
  }

  private findBlockEnd(lines: string[], start: number): number {
    let depth = 0
    for (let i = start; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === "{" || ch === "(" || ch === "[") depth++
        if (ch === "}" || ch === ")" || ch === "]") depth--
      }
      if (depth <= 0 && i > start) return i + 1
    }
    return Math.min(start + 50, lines.length)
  }

  private detectLanguage(ext: string): string {
    const map: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".mjs": "javascript",
      ".py": "python",
      ".pyi": "python",
      ".rs": "rust",
      ".go": "go",
      ".java": "java",
      ".c": "c",
      ".cpp": "cpp",
      ".h": "c",
      ".hpp": "cpp",
      ".rb": "ruby",
      ".php": "php",
      ".swift": "swift",
      ".kt": "kotlin",
    }
    return map[ext] || "unknown"
  }

  private hashContent(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return hash.toString(36)
  }

  private async walkDir(dir: string): Promise<string[]> {
    const files: string[] = []
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (!this.options.excludePatterns.includes(entry.name)) {
            files.push(...await this.walkDir(fullPath))
          }
        } else if (entry.isFile()) {
          files.push(fullPath)
        }
      }
    } catch {}
    return files
  }

  private getFileByPath(filePath: string): RepoFile | undefined {
    const row = this.db.$client.query(`SELECT * FROM repo_files WHERE path = ?`).get(filePath) as any
    if (!row) return undefined
    return this.rowToFile(row)
  }

  private getSymbolById(id: string): RepoSymbol | undefined {
    const row = this.db.$client.query(`SELECT * FROM repo_symbols WHERE id = ?`).get(id) as any
    if (!row) return undefined
    return this.rowToSymbol(row)
  }

  private upsertFile(file: RepoFile): void {
    this.db.$client.run(
      `INSERT OR REPLACE INTO repo_files (path, language, hash, symbols, imports, exports, lines, last_indexed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [file.path, file.language, file.hash, JSON.stringify(file.symbols), JSON.stringify(file.imports), JSON.stringify(file.exports), file.lines, file.lastIndexed],
    )
  }

  private upsertSymbol(symbol: RepoSymbol): void {
    this.db.$client.run(
      `INSERT OR REPLACE INTO repo_symbols (id, name, kind, file_path, start_line, end_line, signature, docstring, imports, exports, calls, extends, implements, hash, last_indexed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [symbol.id, symbol.name, symbol.kind, symbol.filePath, symbol.startLine, symbol.endLine, symbol.signature, symbol.docstring, JSON.stringify(symbol.imports), JSON.stringify(symbol.exports), JSON.stringify(symbol.calls), JSON.stringify(symbol.extends), JSON.stringify(symbol.implements), symbol.hash, symbol.lastIndexed],
    )
  }

  private rowToSymbol(row: any): RepoSymbol {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      filePath: row.file_path,
      startLine: row.start_line,
      endLine: row.end_line,
      signature: row.signature,
      docstring: row.docstring,
      imports: JSON.parse(row.imports || "[]"),
      exports: JSON.parse(row.exports || "[]"),
      calls: JSON.parse(row.calls || "[]"),
      extends: JSON.parse(row.extends || "[]"),
      implements: JSON.parse(row.implements || "[]"),
      hash: row.hash,
      lastIndexed: row.last_indexed,
    }
  }

  private rowToFile(row: any): RepoFile {
    return {
      path: row.path,
      language: row.language,
      hash: row.hash,
      symbols: JSON.parse(row.symbols || "[]"),
      imports: JSON.parse(row.imports || "[]"),
      exports: JSON.parse(row.exports || "[]"),
      lines: row.lines,
      lastIndexed: row.last_indexed,
    }
  }
}
