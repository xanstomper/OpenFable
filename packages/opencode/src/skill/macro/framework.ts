import fs from "fs"
import path from "path"
import yaml from "js-yaml"
import { Log } from "@/util"

const log = Log.create({ service: "skill-macro" })

export interface SkillDefinition {
  name: string
  description: string
  trigger: string
  steps: SkillStep[]
  variables: SkillVariable[]
  examples: string[]
  author: string
  version: string
}

export interface SkillStep {
  id: string
  type: "prompt" | "tool" | "condition" | "loop" | "parallel"
  config: Record<string, any>
  next?: string
  onError?: string
}

export interface SkillVariable {
  name: string
  type: "string" | "number" | "boolean" | "file" | "list"
  description: string
  required: boolean
  default?: any
}

export interface SkillContext {
  variables: Record<string, any>
  history: Array<{ stepId: string; input: any; output: any }>
  workDir: string
}

export class SkillMacroFramework {
  private skills: Map<string, SkillDefinition> = new Map()
  private skillsDir: string

  constructor(skillsDir: string, opts?: { autoLoad?: boolean }) {
    this.skillsDir = skillsDir
    if (skillsDir) {
      this.ensureDir()
    }
    if (opts?.autoLoad !== false && skillsDir) {
      this.loadSkills()
    }
  }

  loadFromFile(filePath: string): void {
    const skill = SkillMacroFramework.parseFile(filePath)
    this.skills.set(skill.name, skill)
    log.info(`Loaded skill: ${skill.name}`)
  }

  static parseFile(filePath: string): SkillDefinition {
    const content = fs.readFileSync(filePath, "utf-8")
    if (filePath.endsWith(".json")) return JSON.parse(content)
    return yaml.load(content) as SkillDefinition
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true })
    }
  }

  private loadSkills(): void {
    try {
      const files = fs.readdirSync(this.skillsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml") || f.endsWith(".json"))
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(this.skillsDir, file), "utf-8")
          let skill: SkillDefinition
          if (file.endsWith(".json")) {
            skill = JSON.parse(content)
          } else {
            skill = yaml.load(content) as SkillDefinition
          }
          this.skills.set(skill.name, skill)
          log.info(`Loaded skill: ${skill.name}`)
        } catch (e) {
          log.warn(`Failed to load skill ${file}: ${e}`)
        }
      }
    } catch {}
  }

  registerSkill(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill)
    this.saveSkill(skill)
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name)
  }

  listSkills(): SkillDefinition[] {
    return Array.from(this.skills.values())
  }

  findSkillByTrigger(trigger: string): SkillDefinition | undefined {
    return this.listSkills().find((s) => trigger.startsWith(s.trigger))
  }

  async execute(skillName: string, context: SkillContext): Promise<{ output: string; context: SkillContext }> {
    const skill = this.skills.get(skillName)
    if (!skill) throw new Error(`Skill not found: ${skillName}`)

    for (const variable of skill.variables) {
      if (context.variables[variable.name] === undefined && variable.default !== undefined) {
        context.variables[variable.name] = variable.default
      }
    }

    log.info(`Executing skill: ${skillName}`)
    let currentStepId = skill.steps[0]?.id
    const visited = new Set<string>()

    while (currentStepId) {
      if (visited.has(currentStepId)) {
        log.warn(`Cycle detected at step ${currentStepId}`)
        break
      }
      visited.add(currentStepId)

      const step = skill.steps.find((s) => s.id === currentStepId)
      if (!step) break

      try {
        const output = await this.executeStep(step, context)
        context.history.push({ stepId: step.id, input: context.variables, output })

        if (step.type === "condition") {
          currentStepId = output.nextStep ?? step.next
        } else {
          currentStepId = (step as any).next
        }
      } catch (error) {
        log.error(`Step ${step.id} failed: ${error}`)
        if (step.onError) {
          currentStepId = step.onError
        } else {
          throw error
        }
      }
    }

    const lastOutput = context.history[context.history.length - 1]?.output
    return {
      output: lastOutput?.text ?? lastOutput?.result ?? JSON.stringify(lastOutput),
      context,
    }
  }

  private async executeStep(step: SkillStep, context: SkillContext): Promise<any> {
    switch (step.type) {
      case "prompt":
        return this.executePromptStep(step, context)
      case "tool":
        return this.executeToolStep(step, context)
      case "condition":
        return this.executeConditionStep(step, context)
      case "loop":
        return this.executeLoopStep(step, context)
      case "parallel":
        return this.executeParallelStep(step, context)
      default:
        return { text: "" }
    }
  }

  private async executePromptStep(step: SkillStep, context: SkillContext): Promise<any> {
    const template = step.config.template ?? ""
    const prompt = this.interpolate(template, context.variables)
    return { text: prompt, type: "prompt" }
  }

  private async executeToolStep(step: SkillStep, context: SkillContext): Promise<any> {
    const toolName = step.config.tool
    const args = this.interpolateObj(step.config.args ?? {}, context.variables)
    return { result: `Tool ${toolName} executed`, tool: toolName, args, type: "tool" }
  }

  private async executeConditionStep(step: SkillStep, context: SkillContext): Promise<any> {
    const condition = step.config.condition
    let result = false

    if (typeof condition === "string") {
      const value = context.variables[condition]
      result = !!value
    } else if (typeof condition === "function") {
      result = condition(context.variables)
    }

    return { conditionResult: result, nextStep: result ? step.config.trueStep : step.config.falseStep }
  }

  private async executeLoopStep(step: SkillStep, context: SkillContext): Promise<any> {
    const items = context.variables[step.config.listVariable] ?? []
    const results: any[] = []

    for (const item of items) {
      context.variables[step.config.itemVariable ?? "item"] = item
      const output = await this.executeStep(step.config.body, context)
      results.push(output)
    }

    return { results, type: "loop" }
  }

  private async executeParallelStep(step: SkillStep, context: SkillContext): Promise<any> {
    const steps = step.config.steps ?? []
    const results = await Promise.all(
      steps.map((s: SkillStep) => this.executeStep(s, context)),
    )
    return { results, type: "parallel" }
  }

  private interpolate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables[key] ?? ""))
  }

  private interpolateObj(obj: any, variables: Record<string, any>): any {
    if (typeof obj === "string") return this.interpolate(obj, variables)
    if (Array.isArray(obj)) return obj.map((item) => this.interpolateObj(item, variables))
    if (typeof obj === "object" && obj !== null) {
      const result: Record<string, any> = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateObj(value, variables)
      }
      return result
    }
    return obj
  }

  private saveSkill(skill: SkillDefinition): void {
    const filePath = path.join(this.skillsDir, `${skill.name}.yaml`)
    fs.writeFileSync(filePath, this.toYaml(skill), "utf-8")
  }

  private parseYaml(content: string): SkillDefinition {
    const lines = content.split("\n")
    const result: any = {}
    let currentKey = ""
    let currentValue = ""

    for (const line of lines) {
      if (line.startsWith("#") || line.trim() === "") continue
      const match = line.match(/^(\w+):\s*(.*)$/)
      if (match) {
        if (currentKey) result[currentKey] = currentValue.trim()
        currentKey = match[1]
        currentValue = match[2]
      } else {
        currentValue += "\n" + line
      }
    }
    if (currentKey) result[currentKey] = currentValue.trim()

    return {
      name: result.name || "unnamed",
      description: result.description || "",
      trigger: result.trigger || "",
      steps: JSON.parse(result.steps || "[]"),
      variables: JSON.parse(result.variables || "[]"),
      examples: JSON.parse(result.examples || "[]"),
      author: result.author || "unknown",
      version: result.version || "1.0.0",
    }
  }

  private toYaml(skill: SkillDefinition): string {
    return [
      `name: ${skill.name}`,
      `description: ${skill.description}`,
      `trigger: ${skill.trigger}`,
      `author: ${skill.author}`,
      `version: ${skill.version}`,
      `steps: ${JSON.stringify(skill.steps)}`,
      `variables: ${JSON.stringify(skill.variables)}`,
      `examples: ${JSON.stringify(skill.examples)}`,
    ].join("\n")
  }
}
