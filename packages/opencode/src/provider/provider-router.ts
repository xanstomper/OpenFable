import { Log } from "../util"
import { isOnCooldown, recordFailure, recordSuccess, getCooldownInfo } from "./cooldown-cache"
import { classifyError, type ProviderErrorDetails, type ProviderErrorCategory } from "./error-hierarchy"

const log = Log.create({ service: "provider-router" })

export interface ProviderRoute {
  providerID: string
  modelID: string
  priority: number
  isAvailable: () => boolean
}

export interface RoutingResult {
  providerID: string
  modelID: string
  fallbacksAttempted: string[]
  error?: ProviderErrorDetails
}

export interface RoutingConfig {
  maxRetries: number
  enableCooldown: boolean
  fallbackOnAuthError: boolean
  fallbackOnServerError: boolean
  preferCheapest: boolean
}

const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  maxRetries: 3,
  enableCooldown: true,
  fallbackOnAuthError: false,
  fallbackOnServerError: true,
  preferCheapest: false,
}

let routingConfig: RoutingConfig = { ...DEFAULT_ROUTING_CONFIG }

export function configureRouting(overrides: Partial<RoutingConfig>): void {
  routingConfig = { ...routingConfig, ...overrides }
}

export function getRoutingConfig(): RoutingConfig {
  return { ...routingConfig }
}

function sortRoutesByPriority(routes: ProviderRoute[]): ProviderRoute[] {
  return [...routes].sort((a, b) => a.priority - b.priority)
}

function shouldFallback(error: ProviderErrorDetails): boolean {
  if (error.category === "authentication") return routingConfig.fallbackOnAuthError
  if (error.category === "server_error") return routingConfig.fallbackOnServerError
  if (error.category === "rate_limit") return true
  if (error.category === "timeout") return true
  if (error.category === "network") return true
  return false
}

function filterAvailableRoutes(
  routes: ProviderRoute[],
  excludeProviders: Set<string>,
): ProviderRoute[] {
  return routes.filter((route) => {
    if (excludeProviders.has(route.providerID)) return false
    if (routingConfig.enableCooldown && isOnCooldown(route.providerID, route.modelID)) return false
    if (!route.isAvailable()) return false
    return true
  })
}

export async function routeRequest(
  routes: ProviderRoute[],
  handler: (providerID: string, modelID: string) => Promise<unknown>,
): Promise<RoutingResult> {
  const sorted = sortRoutesByPriority(routes)
  const excludeProviders = new Set<string>()
  const fallbacksAttempted: string[] = []

  for (let attempt = 0; attempt <= routingConfig.maxRetries; attempt++) {
    const available = filterAvailableRoutes(sorted, excludeProviders)

    if (available.length === 0) {
      log.warn("no available providers for request", {
        excludedCount: excludeProviders.size,
        attempted: fallbacksAttempted,
      })
      return {
        providerID: "",
        modelID: "",
        fallbacksAttempted,
        error: {
          category: "unknown",
          providerID: "",
          isRetryable: false,
          message: "No available providers",
        },
      }
    }

    for (const route of available) {
      try {
        await handler(route.providerID, route.modelID)
        recordSuccess(route.providerID, route.modelID)
        return {
          providerID: route.providerID,
          modelID: route.modelID,
          fallbacksAttempted,
        }
      } catch (error) {
        const details = classifyError(route.providerID, error)
        recordFailure(route.providerID, route.modelID, details.message)
        fallbacksAttempted.push(route.providerID)

        log.warn("provider request failed", {
          providerID: route.providerID,
          modelID: route.modelID,
          category: details.category,
          isRetryable: details.isRetryable,
          attempt,
        })

        if (!shouldFallback(details)) {
          return {
            providerID: route.providerID,
            modelID: route.modelID,
            fallbacksAttempted,
            error: details,
          }
        }

        excludeProviders.add(route.providerID)
        break
      }
    }
  }

  const lastRoute = sorted[sorted.length - 1]
  return {
    providerID: lastRoute?.providerID ?? "",
    modelID: lastRoute?.modelID ?? "",
    fallbacksAttempted,
    error: {
      category: "unknown",
      providerID: lastRoute?.providerID ?? "",
      isRetryable: false,
      message: "All retries exhausted",
    },
  }
}

export function buildRoutesFromModels(
  models: Array<{ providerID: string; modelID: string; cost?: number }>,
  availabilityCheck?: (providerID: string, modelID: string) => boolean,
): ProviderRoute[] {
  const sorted = routingConfig.preferCheapest
    ? [...models].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))
    : [...models]

  return sorted.map((model, index) => ({
    providerID: model.providerID,
    modelID: model.modelID,
    priority: index,
    isAvailable: () => availabilityCheck?.(model.providerID, model.modelID) ?? true,
  }))
}

export function selectBestRoute(
  routes: ProviderRoute[],
): ProviderRoute | undefined {
  const available = filterAvailableRoutes(routes, new Set())
  if (available.length === 0) return undefined
  return available[0]
}
