import { NamedError } from "@openfable/shared/util/error"
import { z } from "zod"

export type ProviderErrorCategory =
  | "authentication"
  | "rate_limit"
  | "quota"
  | "context_overflow"
  | "model_not_found"
  | "invalid_request"
  | "network"
  | "server_error"
  | "content_filter"
  | "timeout"
  | "unknown"

export interface ProviderErrorDetails {
  category: ProviderErrorCategory
  providerID: string
  modelID?: string
  statusCode?: number
  isRetryable: boolean
  message: string
  originalError?: unknown
  metadata?: Record<string, unknown>
}

export const AuthenticationError = NamedError.create(
  "ProviderAuthenticationError",
  z.object({
    providerID: z.string(),
    message: z.string(),
    originalMessage: z.string().optional(),
  }),
)

export const RateLimitError = NamedError.create(
  "ProviderRateLimitError",
  z.object({
    providerID: z.string(),
    message: z.string(),
    retryAfterMs: z.number().optional(),
    originalMessage: z.string().optional(),
  }),
)

export const QuotaExceededError = NamedError.create(
  "ProviderQuotaExceededError",
  z.object({
    providerID: z.string(),
    message: z.string(),
    originalMessage: z.string().optional(),
  }),
)

export const ContextOverflowError = NamedError.create(
  "ProviderContextOverflowError",
  z.object({
    providerID: z.string(),
    modelID: z.string().optional(),
    message: z.string(),
    contextWindow: z.number().optional(),
    originalMessage: z.string().optional(),
  }),
)

export const ModelNotFoundError = NamedError.create(
  "ProviderModelNotFoundError",
  z.object({
    providerID: z.string(),
    modelID: z.string(),
    suggestions: z.array(z.string()).optional(),
    originalMessage: z.string().optional(),
  }),
)

export const NetworkError = NamedError.create(
  "ProviderNetworkError",
  z.object({
    providerID: z.string(),
    message: z.string(),
    isRetryable: z.boolean(),
    originalMessage: z.string().optional(),
  }),
)

export const ServerError = NamedError.create(
  "ProviderServerError",
  z.object({
    providerID: z.string(),
    statusCode: z.number(),
    message: z.string(),
    isRetryable: z.boolean(),
    originalMessage: z.string().optional(),
  }),
)

export const ContentFilterError = NamedError.create(
  "ProviderContentFilterError",
  z.object({
    providerID: z.string(),
    message: z.string(),
    originalMessage: z.string().optional(),
  }),
)

const OVERFLOW_PATTERNS = [
  /prompt is too long/i,
  /input is too long for requested model/i,
  /exceeds the context window/i,
  /input token count.*exceeds the maximum/i,
  /maximum prompt length is \d+/i,
  /reduce the length of the messages/i,
  /maximum context length is \d+ tokens/i,
  /exceeds the limit of \d+/i,
  /context length exceeded/i,
  /context[_ ]length[_ ]exceeded/i,
  /request entity too large/i,
  /input length.*exceeds.*context length/i,
  /too large for model with \d+ maximum context length/i,
]

const AUTH_PATTERNS = [
  /unauthorized/i,
  /invalid.*api.*key/i,
  /authentication.*failed/i,
  /access.*denied/i,
  /invalid.*credentials/i,
  /token.*expired/i,
  /invalid.*token/i,
]

const RATE_LIMIT_PATTERNS = [
  /rate.*limit.*exceeded/i,
  /too many requests/i,
  /requests.*per.*minute/i,
  /throttled/i,
  /quota.*exceeded.*rate/i,
]

const QUOTA_PATTERNS = [
  /quota.*exceeded/i,
  /insufficient.*quota/i,
  /billing.*required/i,
  /payment.*required/i,
  /usage.*limit.*reached/i,
]

const CONTENT_FILTER_PATTERNS = [
  /content.*filter/i,
  /content.*moderation/i,
  /safety.*filter/i,
  /blocked.*content/i,
  /content.*policy/i,
  /nsfw/i,
]

const TIMEOUT_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /deadline exceeded/i,
  /request timeout/i,
]

function matchesPatterns(message: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(message))
}

export function classifyError(
  providerID: string,
  error: unknown,
): ProviderErrorDetails {
  const message = error instanceof Error ? error.message : String(error)
  const statusCode = extractStatusCode(error)
  const isRetryable = extractRetryability(error)

  if (matchesPatterns(message, AUTH_PATTERNS) || statusCode === 401 || statusCode === 403) {
    return {
      category: "authentication",
      providerID,
      statusCode,
      isRetryable: false,
      message: `Authentication failed for ${providerID}: ${message}`,
      originalError: error,
    }
  }

  if (matchesPatterns(message, RATE_LIMIT_PATTERNS) || statusCode === 429) {
    const retryAfterMs = extractRetryAfter(error)
    return {
      category: "rate_limit",
      providerID,
      statusCode,
      isRetryable: true,
      message: `Rate limited by ${providerID}: ${message}`,
      originalError: error,
      metadata: retryAfterMs ? { retryAfterMs } : undefined,
    }
  }

  if (matchesPatterns(message, QUOTA_PATTERNS) || statusCode === 402) {
    return {
      category: "quota",
      providerID,
      statusCode,
      isRetryable: false,
      message: `Quota exceeded for ${providerID}: ${message}`,
      originalError: error,
    }
  }

  if (matchesPatterns(message, OVERFLOW_PATTERNS) || statusCode === 413) {
    return {
      category: "context_overflow",
      providerID,
      statusCode,
      isRetryable: false,
      message: `Context overflow for ${providerID}: ${message}`,
      originalError: error,
    }
  }

  if (matchesPatterns(message, CONTENT_FILTER_PATTERNS) || statusCode === 400) {
    return {
      category: "content_filter",
      providerID,
      statusCode,
      isRetryable: false,
      message: `Content filtered by ${providerID}: ${message}`,
      originalError: error,
    }
  }

  if (matchesPatterns(message, TIMEOUT_PATTERNS)) {
    return {
      category: "timeout",
      providerID,
      statusCode,
      isRetryable: true,
      message: `Request timed out for ${providerID}: ${message}`,
      originalError: error,
    }
  }

  if (statusCode && statusCode >= 500) {
    return {
      category: "server_error",
      providerID,
      statusCode,
      isRetryable: statusCode !== 501,
      message: `Server error from ${providerID} (${statusCode}): ${message}`,
      originalError: error,
    }
  }

  if (!statusCode || (statusCode >= 400 && statusCode < 500)) {
    return {
      category: "network",
      providerID,
      statusCode,
      isRetryable,
      message: `Network error for ${providerID}: ${message}`,
      originalError: error,
    }
  }

  return {
    category: "unknown",
    providerID,
    statusCode,
    isRetryable,
    message: `Unknown error from ${providerID}: ${message}`,
    originalError: error,
  }
}

function extractStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    if ("statusCode" in error && typeof (error as any).statusCode === "number") {
      return (error as any).statusCode
    }
    if ("status" in error && typeof (error as any).status === "number") {
      return (error as any).status
    }
    if ("responseBody" in error) {
      try {
        const body = JSON.parse(String((error as any).responseBody))
        if (body?.error?.code) {
          const code = Number(body.error.code)
          if (!isNaN(code)) return code
        }
      } catch {}
    }
  }
  return undefined
}

function extractRetryability(error: unknown): boolean {
  if (error && typeof error === "object" && "isRetryable" in error) {
    return Boolean((error as any).isRetryable)
  }
  return false
}

function extractRetryAfter(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    if ("retryAfterMs" in error && typeof (error as any).retryAfterMs === "number") {
      return (error as any).retryAfterMs
    }
    if ("responseHeaders" in error) {
      const headers = (error as any).responseHeaders
      if (headers && typeof headers === "object") {
        const retryAfter = headers["retry-after"] ?? headers["Retry-After"]
        if (retryAfter) {
          const seconds = Number(retryAfter)
          if (!isNaN(seconds)) return seconds * 1000
        }
      }
    }
  }
  return undefined
}

export function toTypedError(
  providerID: string,
  error: unknown,
): Error {
  const details = classifyError(providerID, error)

  switch (details.category) {
    case "authentication":
      return new AuthenticationError({
        providerID: details.providerID,
        message: details.message,
      })
    case "rate_limit":
      return new RateLimitError({
        providerID: details.providerID,
        message: details.message,
        retryAfterMs: details.metadata?.retryAfterMs as number | undefined,
      })
    case "quota":
      return new QuotaExceededError({
        providerID: details.providerID,
        message: details.message,
      })
    case "context_overflow":
      return new ContextOverflowError({
        providerID: details.providerID,
        modelID: details.modelID,
        message: details.message,
      })
    case "network":
      return new NetworkError({
        providerID: details.providerID,
        message: details.message,
        isRetryable: details.isRetryable,
      })
    case "server_error":
      return new ServerError({
        providerID: details.providerID,
        statusCode: details.statusCode ?? 500,
        message: details.message,
        isRetryable: details.isRetryable,
      })
    case "content_filter":
      return new ContentFilterError({
        providerID: details.providerID,
        message: details.message,
      })
    default:
      return error instanceof Error ? error : new Error(details.message)
  }
}
