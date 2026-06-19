import { MYTHOS_CLAUDE_OPERATIONAL } from "../../abiliterate"

export function wrapMythosSystemPrompt(
  modelId: string,
  provider: string,
  agentName: string,
  basePrompts: string[],
): string[] {
  return [
    `<mythos_wrapper model="${modelId}" provider="${provider}" agent="${agentName}">`,
    "",
    MYTHOS_CLAUDE_OPERATIONAL,
    ...basePrompts,
    `</mythos_wrapper>`,
  ]
}

export function wrapMythosText(
  modelId: string,
  provider: string,
  agentName: string,
  text: string,
): string {
  return [
    `<mythos_wrapper model="${modelId}" provider="${provider}" agent="${agentName}">`,
    "",
    MYTHOS_CLAUDE_OPERATIONAL,
    `</mythos_wrapper>`,
    "",
    "---",
    "",
    text,
  ].join("\n")
}
