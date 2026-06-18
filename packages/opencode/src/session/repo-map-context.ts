import { RepoMap } from "@/knowledge"
import type { Provider } from "@/provider"

const cache = new Map<string, RepoMap>()

const MIN_CONTEXT_FOR_REPO_MAP = 200_000
const REPO_MAP_TOKEN_BUDGET = 4000

const EXCLUDE_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "__pycache__",
  ".next",
  "target",
  "vendor",
  ".cache",
  "references",
  ".dev-home",
  "assets",
  "sdks",
  ".husky",
  ".github",
]

function getRepoMap(root: string): RepoMap {
  const existing = cache.get(root)
  if (existing) return existing
  const map = new RepoMap({
    root,
    tokenBudget: REPO_MAP_TOKEN_BUDGET,
    excludePatterns: EXCLUDE_PATTERNS,
  })
  cache.set(root, map)
  return map
}

export async function getContext(model: Provider.Model): Promise<string> {
  if (model.limit.context < MIN_CONTEXT_FOR_REPO_MAP) return ""
  const root = process.env.OPENFABLE_PROJECT_ROOT || process.cwd()
  const map = getRepoMap(root)
  await map.indexFull()
  const result = map.fitToTokenBudget(REPO_MAP_TOKEN_BUDGET)
  if (!result.tree) return ""
  return [
    "## Repository map",
    "A PageRank-weighted view of the most important files and symbols in this project, derived from imports and call graphs (aider-style).",
    "",
    result.tree,
    "",
    `Included ${result.filesIncluded} files, ~${result.tokensUsed} tokens.`,
  ].join("\n")
}
