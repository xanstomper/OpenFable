export interface GraphNode {
  id: string
  name: string
  type: "llm" | "tool" | "condition" | "transform" | "human" | "end"
  config: Record<string, any>
  next: string[]
  onError?: string
}

export interface GraphEdge {
  from: string
  to: string
  condition?: (state: GraphState) => boolean
  label?: string
}

export interface GraphState {
  data: Record<string, any>
  history: Array<{ nodeId: string; input: any; output: any; timestamp: number }>
  currentNode: string
  status: "running" | "paused" | "completed" | "failed"
  error?: string
}

export interface GraphDefinition {
  id: string
  name: string
  description: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  entryNode: string
  createdAt: number
}

export class GraphWorkflowEngine {
  private graphs: Map<string, GraphDefinition> = new Map()
  private running: Map<string, GraphState> = new Map()

  registerGraph(graph: GraphDefinition): void {
    this.graphs.set(graph.id, graph)
  }

  getGraph(id: string): GraphDefinition | undefined {
    return this.graphs.get(id)
  }

  listGraphs(): GraphDefinition[] {
    return Array.from(this.graphs.values())
  }

  async execute(graphId: string, initialData: Record<string, any> = {}): Promise<GraphState> {
    const graph = this.graphs.get(graphId)
    if (!graph) throw new Error(`Graph not found: ${graphId}`)

    const state: GraphState = {
      data: { ...initialData },
      history: [],
      currentNode: graph.entryNode,
      status: "running",
    }

    this.running.set(graphId, state)

    try {
      while (state.status === "running") {
        const node = graph.nodes.find((n) => n.id === state.currentNode)
        if (!node) {
          state.status = "failed"
          state.error = `Node not found: ${state.currentNode}`
          break
        }

        if (node.type === "end") {
          state.status = "completed"
          break
        }

        const output = await this.executeNode(node, state)
        state.history.push({
          nodeId: node.id,
          input: { ...state.data },
          output,
          timestamp: Date.now(),
        })

        Object.assign(state.data, output)

        const nextNode = this.resolveNext(node, state, graph)
        if (!nextNode) {
          state.status = "completed"
          break
        }
        state.currentNode = nextNode
      }
    } catch (error) {
      state.status = "failed"
      state.error = error instanceof Error ? error.message : String(error)
    } finally {
      this.running.delete(graphId)
    }

    return state
  }

  getState(graphId: string): GraphState | undefined {
    return this.running.get(graphId)
  }

  pause(graphId: string): void {
    const state = this.running.get(graphId)
    if (state) state.status = "paused"
  }

  resume(graphId: string): void {
    const state = this.running.get(graphId)
    if (state && state.status === "paused") state.status = "running"
  }

  private async executeNode(node: GraphNode, state: GraphState): Promise<any> {
    switch (node.type) {
      case "llm":
        return this.executeLLMNode(node, state)
      case "tool":
        return this.executeToolNode(node, state)
      case "condition":
        return this.executeConditionNode(node, state)
      case "transform":
        return this.executeTransformNode(node, state)
      case "human":
        return { waiting: true, prompt: node.config.prompt }
      default:
        return {}
    }
  }

  private async executeLLMNode(node: GraphNode, state: GraphState): Promise<any> {
    const prompt = this.interpolate(node.config.prompt ?? "", state.data)
    return { llmOutput: prompt, model: node.config.model }
  }

  private async executeToolNode(node: GraphNode, state: GraphState): Promise<any> {
    const toolName = node.config.tool
    const args = node.config.args ?? {}
    return { toolOutput: { tool: toolName, args, result: `Executed ${toolName}` } }
  }

  private async executeConditionNode(node: GraphNode, state: GraphState): Promise<any> {
    const condition = node.config.condition
    if (typeof condition === "function") {
      return { conditionResult: condition(state.data) }
    }
    return { conditionResult: true }
  }

  private async executeTransformNode(node: GraphNode, state: GraphState): Promise<any> {
    const transform = node.config.transform
    if (typeof transform === "function") {
      return transform(state.data)
    }
    return {}
  }

  private resolveNext(node: GraphNode, state: GraphState, graph: GraphDefinition): string | null {
    if (node.type === "condition") {
      const edges = graph.edges.filter((e) => e.from === node.id)
      for (const edge of edges) {
        if (edge.condition && edge.condition(state)) {
          return edge.to
        }
      }
      const defaultEdge = edges.find((e) => !e.condition)
      return defaultEdge?.to ?? null
    }

    const edges = graph.edges.filter((e) => e.from === node.id)
    if (edges.length === 0) return null

    const conditionalEdge = edges.find((e) => e.condition && e.condition(state))
    if (conditionalEdge) return conditionalEdge.to

    return edges[0].to
  }

  private interpolate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ""))
  }
}

export function createBuilder(id: string, name: string) {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  let entryNode: string | null = null

  return {
    addNode(config: Omit<GraphNode, "next"> & { next?: string[] }) {
      const node: GraphNode = { ...config, next: config.next ?? [] }
      nodes.push(node)
      if (!entryNode) entryNode = node.id
      return this
    },
    addEdge(from: string, to: string, condition?: (state: GraphState) => boolean, label?: string) {
      edges.push({ from, to, condition, label })
      return this
    },
    setEntry(nodeId: string) {
      entryNode = nodeId
      return this
    },
    build(description: string = ""): GraphDefinition {
      if (!entryNode) throw new Error("No entry node set")
      return {
        id,
        name,
        description,
        nodes,
        edges,
        entryNode,
        createdAt: Date.now(),
      }
    },
  }
}
