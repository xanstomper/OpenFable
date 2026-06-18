import { createHash } from "crypto"

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim()
}

export function contentHash(text: string): string {
  return createHash("sha256").update(normalize(text)).digest("hex").slice(0, 32)
}

export function isDuplicate(
  newHash: string,
  existing: Map<string, string>,
  similarityThreshold = 0.85,
): string | null {
  if (existing.has(newHash)) return newHash

  const newNorm = normalize(newHash)
  for (const [hash, original] of existing) {
    if (jaccardSimilarity(newNorm, normalize(hash)) >= similarityThreshold) {
      return hash
    }
  }
  return null
}

export function fingerprint(size: number, mtimeMs: number): string {
  return `${size}-${mtimeMs}`
}

function jaccardSimilarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const ch of setA) {
    if (setB.has(ch)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

export class DedupStore {
  private hashes = new Map<string, string>()
  private maxEntries: number

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries
  }

  track(hash: string, path: string): void {
    if (this.hashes.size >= this.maxEntries) {
      const first = this.hashes.keys().next().value
      if (first) this.hashes.delete(first)
    }
    this.hashes.set(hash, path)
  }

  isDuplicate(hash: string): string | null {
    return this.hashes.has(hash) ? this.hashes.get(hash)! : null
  }

  remove(path: string): void {
    for (const [hash, p] of this.hashes) {
      if (p === path) {
        this.hashes.delete(hash)
        break
      }
    }
  }

  size(): number {
    return this.hashes.size
  }

  clear(): void {
    this.hashes.clear()
  }
}
