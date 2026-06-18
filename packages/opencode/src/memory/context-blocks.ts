import { WorkingMemory } from "./layers/working"

export interface ContextBlock {
  id: string
  label: string
  content: string
  pinned: boolean
  tokens: number
  lastModified: number
  source: "agent" | "user" | "system"
}

export interface EditOperation {
  op: "add" | "update" | "remove" | "reorder"
  blockId?: string
  content?: string
  label?: string
  pinned?: boolean
  order?: string[]
}

export class SelfEditingContext {
  private blocks: Map<string, ContextBlock> = new Map()
  private workingMemory: WorkingMemory
  private maxTokens: number
  private nextId = 1

  constructor(workingMemory: WorkingMemory, maxTokens = 8000) {
    this.workingMemory = workingMemory
    this.maxTokens = maxTokens
  }

  addBlock(label: string, content: string, source: ContextBlock["source"] = "agent", pinned = false): ContextBlock {
    const id = `cb_${this.nextId++}`
    const block: ContextBlock = {
      id,
      label,
      content,
      pinned,
      tokens: estimateTokens(content),
      lastModified: Date.now(),
      source,
    }
    this.blocks.set(id, block)
    this.enforceTokenBudget()
    return block
  }

  updateBlock(id: string, content: string): ContextBlock | null {
    const block = this.blocks.get(id)
    if (!block) return null
    block.content = content
    block.tokens = estimateTokens(content)
    block.lastModified = Date.now()
    this.enforceTokenBudget()
    return block
  }

  removeBlock(id: string): boolean {
    return this.blocks.delete(id)
  }

  pinBlock(id: string): boolean {
    const block = this.blocks.get(id)
    if (!block) return false
    block.pinned = true
    return true
  }

  unpinBlock(id: string): boolean {
    const block = this.blocks.get(id)
    if (!block) return false
    block.pinned = false
    return true
  }

  reorderBlocks(order: string[]): void {
    const reordered = new Map<string, ContextBlock>()
    for (const id of order) {
      const block = this.blocks.get(id)
      if (block) reordered.set(id, block)
    }
    for (const [id, block] of this.blocks) {
      if (!reordered.has(id)) reordered.set(id, block)
    }
    this.blocks = reordered
  }

  applyEdit(op: EditOperation): ContextBlock | boolean | null {
    switch (op.op) {
      case "add":
        if (!op.content || !op.label) return null
        return this.addBlock(op.label, op.content, "agent", op.pinned ?? false)
      case "update":
        if (!op.blockId || !op.content) return null
        return this.updateBlock(op.blockId, op.content)
      case "remove":
        if (!op.blockId) return null
        return this.removeBlock(op.blockId)
      case "reorder":
        if (!op.order) return null
        this.reorderBlocks(op.order)
        return true
      default:
        return null
    }
  }

  getContextString(): string {
    const sorted = Array.from(this.blocks.values()).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.lastModified - a.lastModified
    })

    const parts: string[] = []
    let tokenCount = 0
    for (const block of sorted) {
      if (tokenCount + block.tokens > this.maxTokens) break
      parts.push(`### ${block.label}\n${block.content}`)
      tokenCount += block.tokens
    }
    return parts.join("\n\n")
  }

  getBlocks(): ContextBlock[] {
    return Array.from(this.blocks.values())
  }

  getBlock(id: string): ContextBlock | undefined {
    return this.blocks.get(id)
  }

  private enforceTokenBudget(): void {
    const total = this.totalTokens()
    if (total <= this.maxTokens) return

    const unpinned = Array.from(this.blocks.values())
      .filter((b) => !b.pinned)
      .sort((a, b) => a.lastModified - b.lastModified)

    for (const block of unpinned) {
      if (total <= this.maxTokens) break
      this.blocks.delete(block.id)
    }
  }

  private totalTokens(): number {
    let total = 0
    for (const block of this.blocks.values()) {
      total += block.tokens
    }
    return total
  }

  syncToWorkingMemory(): void {
    for (const block of this.blocks.values()) {
      this.workingMemory.set(`ctx:${block.id}`, JSON.stringify(block))
    }
  }

  loadFromWorkingMemory(): void {
    const entries = this.workingMemory.getAll()
    for (const entry of entries) {
      if (entry.key.startsWith("ctx:")) {
        try {
          const block = JSON.parse(entry.value) as ContextBlock
          this.blocks.set(block.id, block)
        } catch {}
      }
    }
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
