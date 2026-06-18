export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

export interface ToolSpec {
  name: string
  description: string
  parameters: {
    type: "object"
    properties: Record<string, { type: string; description?: string; enum?: string[] }>
    required?: string[]
  }
}

export interface DialectParseResult {
  thought: string
  calls: ToolCall[]
  final?: string
}

export interface ToolCallDialect {
  name: string
  encodeTools(tools: ToolSpec[]): any
  encodeToolCall(call: ToolCall): string
  parseResponse(raw: string): DialectParseResult
  formatToolResult(callId: string, result: string): any
}

export class OpenAIDialect implements ToolCallDialect {
  name = "openai"

  encodeTools(tools: ToolSpec[]): any {
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))
  }

  encodeToolCall(call: ToolCall): string {
    return JSON.stringify({
      id: call.id,
      type: "function",
      function: {
        name: call.name,
        arguments: JSON.stringify(call.arguments),
      },
    })
  }

  parseResponse(raw: string): DialectParseResult {
    try {
      const parsed = JSON.parse(raw)
      if (parsed.choices?.[0]?.message?.tool_calls) {
        return {
          thought: parsed.choices[0].message.content ?? "",
          calls: parsed.choices[0].message.tool_calls.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          })),
        }
      }
      return { thought: parsed.choices?.[0]?.message?.content ?? raw, calls: [] }
    } catch {
      return { thought: raw, calls: [] }
    }
  }

  formatToolResult(callId: string, result: string): any {
    return { role: "tool", tool_call_id: callId, content: result }
  }
}

export class AnthropicDialect implements ToolCallDialect {
  name = "anthropic"

  encodeTools(tools: ToolSpec[]): any {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }))
  }

  encodeToolCall(call: ToolCall): string {
    return JSON.stringify({
      type: "tool_use",
      id: call.id,
      name: call.name,
      input: call.arguments,
    })
  }

  parseResponse(raw: string): DialectParseResult {
    try {
      const parsed = JSON.parse(raw)
      if (parsed.content) {
        const textParts = parsed.content.filter((c: any) => c.type === "text")
        const toolParts = parsed.content.filter((c: any) => c.type === "tool_use")
        return {
          thought: textParts.map((t: any) => t.text).join("\n"),
          calls: toolParts.map((t: any) => ({
            id: t.id,
            name: t.name,
            arguments: t.input,
          })),
        }
      }
      return { thought: raw, calls: [] }
    } catch {
      return { thought: raw, calls: [] }
    }
  }

  formatToolResult(callId: string, result: string): any {
    return { type: "tool_result", tool_use_id: callId, content: result }
  }
}

export class HermesDialect implements ToolCallDialect {
  name = "hermes"

  encodeTools(tools: ToolSpec[]): any {
    const toolDefs = tools.map((t) => {
      const props = Object.entries(t.parameters.properties)
        .map(([k, v]) => `    "${k}": {"type": "${v.type}"${v.description ? `, "description": "${v.description}"` : ""}}`)
        .join(",\n")
      return `  "${t.name}": {\n    "description": "${t.description}",\n    "parameters": {\n      "type": "object",\n      "properties": {\n${props}\n      },\n      "required": [${(t.parameters.required ?? []).map((r) => `"${r}"`).join(", ")}]\n    }\n  }`
    })

    return `</tool_call>\n{\n  "tools": {\n${toolDefs.join(",\n")}\n  }\n}\n<tool_call>`
  }

  encodeToolCall(call: ToolCall): string {
    return `<tool_call>\n${JSON.stringify({ name: call.name, arguments: call.arguments }, null, 2)}\n</tool_call>`
  }

  parseResponse(raw: string): DialectParseResult {
    const thought = raw.split("<tool_call>")[0].trim()
    const calls: ToolCall[] = []
    const callRegex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g
    let match

    while ((match = callRegex.exec(raw)) !== null) {
      try {
        const parsed = JSON.parse(match[1])
        calls.push({
          id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: parsed.name,
          arguments: parsed.arguments ?? {},
        })
      } catch {}
    }

    if (calls.length === 0 && !thought) {
      return { thought: raw, calls: [], final: raw }
    }

    return { thought, calls, final: calls.length === 0 ? raw : undefined }
  }

  formatToolResult(callId: string, result: string): string {
    return `<tool_call>_result\n{"call_id": "${callId}", "result": ${JSON.stringify(result)}}\n</tool_call>_result`
  }
}

export class XMLDialect implements ToolCallDialect {
  name = "xml"

  encodeTools(tools: ToolSpec[]): any {
    const defs = tools.map((t) => {
      const params = Object.entries(t.parameters.properties)
        .map(([k, v]) => `  <param name="${k}" type="${v.type}">${v.description ?? ""}</param>`)
        .join("\n")
      return `<tool name="${t.name}">\n  <description>${t.description}</description>\n${params}\n</tool>`
    })
    return `<tools>\n${defs.join("\n")}\n</tools>`
  }

  encodeToolCall(call: ToolCall): string {
    const args = Object.entries(call.arguments)
      .map(([k, v]) => `  <arg name="${k}">${JSON.stringify(v)}</arg>`)
      .join("\n")
    return `<tool_call name="${call.name}" id="${call.id}">\n${args}\n</tool_call>`
  }

  parseResponse(raw: string): DialectParseResult {
    const thoughtMatch = raw.match(/<thought>([\s\S]*?)<\/thought>/)
    const thought = thoughtMatch?.[1]?.trim() ?? raw.split("<tool_call")[0].trim()

    const calls: ToolCall[] = []
    const callRegex = /<tool_call\s+name="([^"]+)"\s+id="([^"]+)"([\s\S]*?)<\/tool_call>/g
    let match

    while ((match = callRegex.exec(raw)) !== null) {
      const args: Record<string, any> = {}
      const argRegex = /<arg\s+name="([^"]+)">([\s\S]*?)<\/arg>/g
      let argMatch
      while ((argMatch = argRegex.exec(match[3])) !== null) {
        try {
          args[argMatch[1]] = JSON.parse(argMatch[2])
        } catch {
          args[argMatch[1]] = argMatch[2]
        }
      }
      calls.push({ id: match[2], name: match[1], arguments: args })
    }

    return { thought, calls, final: calls.length === 0 ? raw : undefined }
  }

  formatToolResult(callId: string, result: string): string {
    return `<tool_result id="${callId}">\n${result}\n</tool_result>`
  }
}

export function getDialectForProvider(provider: string): ToolCallDialect {
  switch (provider.toLowerCase()) {
    case "openai":
    case "openai-compatible":
      return new OpenAIDialect()
    case "anthropic":
      return new AnthropicDialect()
    case "hermes":
    case "nousresearch":
      return new HermesDialect()
    default:
      return new OpenAIDialect()
  }
}

export function getDialectForFormat(format: string): ToolCallDialect {
  switch (format.toLowerCase()) {
    case "openai":
      return new OpenAIDialect()
    case "anthropic":
      return new AnthropicDialect()
    case "hermes":
      return new HermesDialect()
    case "xml":
      return new XMLDialect()
    default:
      return new OpenAIDialect()
  }
}
