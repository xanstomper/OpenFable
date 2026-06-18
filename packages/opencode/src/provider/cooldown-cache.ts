import { Log } from "../util"

const log = Log.create({ service: "cooldown-cache" })

export interface CooldownEntry {
  providerID: string
  modelID?: string
  failureCount: number
  lastFailure: number
  cooldownUntil: number
  reason: string
}

export interface CooldownConfig {
  baseCooldownMs: number
  maxCooldownMs: number
  backoffMultiplier: number
  failureThreshold: number
}

const DEFAULT_CONFIG: CooldownConfig = {
  baseCooldownMs: 30_000,
  maxCooldownMs: 300_000,
  backoffMultiplier: 2,
  failureThreshold: 3,
}

const cooldowns = new Map<string, CooldownEntry>()
let config: CooldownConfig = { ...DEFAULT_CONFIG }

export function configureCooldown(overrides: Partial<CooldownConfig>): void {
  config = { ...config, ...overrides }
}

function makeKey(providerID: string, modelID?: string): string {
  return modelID ? `${providerID}/${modelID}` : providerID
}

export function isOnCooldown(providerID: string, modelID?: string): boolean {
  const key = makeKey(providerID, modelID)
  const entry = cooldowns.get(key)
  if (!entry) return false

  if (Date.now() >= entry.cooldownUntil) {
    cooldowns.delete(key)
    return false
  }

  return true
}

export function recordFailure(providerID: string, modelID: string | undefined, reason: string): void {
  const key = makeKey(providerID, modelID)
  const existing = cooldowns.get(key)

  const failureCount = (existing?.failureCount ?? 0) + 1
  const now = Date.now()

  if (failureCount >= config.failureThreshold) {
    const cooldownMs = Math.min(
      config.baseCooldownMs * Math.pow(config.backoffMultiplier, failureCount - config.failureThreshold),
      config.maxCooldownMs,
    )

    const entry: CooldownEntry = {
      providerID,
      modelID,
      failureCount,
      lastFailure: now,
      cooldownUntil: now + cooldownMs,
      reason,
    }

    cooldowns.set(key, entry)
    log.warn("provider put on cooldown", {
      providerID,
      modelID,
      failureCount,
      cooldownMs,
      reason,
    })
  } else {
    const entry: CooldownEntry = {
      providerID,
      modelID,
      failureCount,
      lastFailure: now,
      cooldownUntil: now,
      reason,
    }
    cooldowns.set(key, entry)
  }
}

export function recordSuccess(providerID: string, modelID?: string): void {
  const key = makeKey(providerID, modelID)
  const entry = cooldowns.get(key)
  if (entry) {
    entry.failureCount = Math.max(0, entry.failureCount - 1)
    if (entry.failureCount === 0) {
      cooldowns.delete(key)
    }
  }
}

export function getCooldownInfo(providerID: string, modelID?: string): CooldownEntry | undefined {
  const key = makeKey(providerID, modelID)
  return cooldowns.get(key)
}

export function getActiveCooldowns(): CooldownEntry[] {
  const now = Date.now()
  return Array.from(cooldowns.values()).filter((entry) => now < entry.cooldownUntil)
}

export function clearCooldown(providerID: string, modelID?: string): void {
  const key = makeKey(providerID, modelID)
  cooldowns.delete(key)
}

export function clearAllCooldowns(): void {
  cooldowns.clear()
}
