/**
 * Rate Limiter using Cloudflare KV (Phase 5)
 *
 * Simple sliding window rate limiter for abuse protection.
 * Uses KV for storage - works on free plan.
 *
 * Features:
 * - Per-phone-number rate limiting
 * - Per-business rate limiting
 * - Configurable windows and limits
 * - Graceful handling when KV is slow
 *
 * Note: KV is eventually consistent, so this is "best effort"
 * rate limiting. For strict rate limiting, use Durable Objects.
 */

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// ============================================================================
// Default Configs
// ============================================================================

/** Per-phone rate limit: 30 messages per minute */
export const PHONE_RATE_LIMIT: RateLimitConfig = {
  limit: 30,
  windowSeconds: 60,
};

/** Per-business rate limit: 1000 messages per minute */
export const BUSINESS_RATE_LIMIT: RateLimitConfig = {
  limit: 1000,
  windowSeconds: 60,
};

/** Burst protection: 5 messages per 10 seconds */
export const BURST_RATE_LIMIT: RateLimitConfig = {
  limit: 5,
  windowSeconds: 10,
};

// ============================================================================
// Rate Limiter Implementation
// ============================================================================

/**
 * Check rate limit using KV sliding window counter.
 *
 * Uses a simple counter with TTL. Not perfectly accurate due to
 * KV's eventual consistency, but good enough for abuse protection.
 */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / config.windowSeconds) * config.windowSeconds;
  const kvKey = `ratelimit:${key}:${windowStart}`;

  try {
    // Get current count
    const currentValue = await kv.get(kvKey);
    const currentCount = currentValue ? parseInt(currentValue, 10) : 0;

    if (currentCount >= config.limit) {
      // Rate limited
      const resetAt = windowStart + config.windowSeconds;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: resetAt - now,
      };
    }

    // H1 FIX: Await PUT and fail closed on error
    // This prevents race conditions where multiple requests slip through
    const newCount = currentCount + 1;
    const ttl = Math.max(60, config.windowSeconds * 2);
    try {
      await kv.put(kvKey, newCount.toString(), {
        expirationTtl: ttl,
      });
    } catch (err) {
      console.error('Rate limit KV write failed, failing closed:', err);
      // Fail closed: if we can't track the rate limit, deny the request
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + config.windowSeconds,
        retryAfter: config.windowSeconds,
      };
    }

    return {
      allowed: true,
      remaining: config.limit - newCount,
      resetAt: windowStart + config.windowSeconds,
    };
  } catch (error) {
    // H1 FIX: Fail closed on KV read errors too
    console.error('Rate limit check failed, failing closed:', error);
    return {
      allowed: false,
      remaining: 0,
      resetAt: now + config.windowSeconds,
      retryAfter: config.windowSeconds,
    };
  }
}

/**
 * Check multiple rate limits at once.
 * Returns the most restrictive result.
 */
export async function checkRateLimits(
  kv: KVNamespace,
  checks: Array<{ key: string; config: RateLimitConfig }>
): Promise<RateLimitResult & { limitedBy?: string }> {
  const results = await Promise.all(
    checks.map(async ({ key, config }) => ({
      key,
      result: await checkRateLimit(kv, key, config),
    }))
  );

  // Find the first failed check
  const failed = results.find(r => !r.result.allowed);
  if (failed) {
    return {
      ...failed.result,
      limitedBy: failed.key,
    };
  }

  // All passed - return the one with least remaining
  const mostRestrictive = results.reduce((min, curr) =>
    curr.result.remaining < min.result.remaining ? curr : min
  );

  return mostRestrictive.result;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Check if a phone number is rate limited.
 * Checks both burst and sustained rate limits.
 */
export async function isPhoneRateLimited(
  kv: KVNamespace,
  phoneNumber: string
): Promise<RateLimitResult & { limitedBy?: string }> {
  return checkRateLimits(kv, [
    { key: `phone:burst:${phoneNumber}`, config: BURST_RATE_LIMIT },
    { key: `phone:${phoneNumber}`, config: PHONE_RATE_LIMIT },
  ]);
}

/**
 * Check if a business is rate limited.
 */
export async function isBusinessRateLimited(
  kv: KVNamespace,
  businessId: string
): Promise<RateLimitResult> {
  return checkRateLimit(kv, `business:${businessId}`, BUSINESS_RATE_LIMIT);
}

/**
 * Build rate limit error response for WhatsApp.
 */
export function buildRateLimitResponse(result: RateLimitResult): string {
  const waitMinutes = Math.ceil((result.retryAfter || 60) / 60);
  if (waitMinutes <= 1) {
    return "I'm getting a lot of messages right now! Give me a moment and try again.";
  }
  return `I'm getting a lot of messages right now! Please try again in about ${waitMinutes} minutes.`;
}
