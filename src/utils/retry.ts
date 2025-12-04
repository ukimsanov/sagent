/**
 * Retry utilities with exponential backoff
 *
 * H3 FIX: Adds retry logic for external API calls (WhatsApp, OpenAI)
 * to prevent message loss from transient failures
 */

// ============================================================================
// Types
// ============================================================================

export interface RetryOptions {
  /** Maximum number of attempts (including first try) */
  maxAttempts?: number;
  /** Base delay in milliseconds (doubles each retry) */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs?: number;
  /** Whether to retry on this error (default: always retry) */
  shouldRetry?: (error: unknown) => boolean;
  /** Called before each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: unknown;
  attempts: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'shouldRetry'>> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

// ============================================================================
// Main Retry Function
// ============================================================================

/**
 * Execute a function with exponential backoff retry
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration
 * @returns Promise resolving to the function result
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (config.shouldRetry && !config.shouldRetry(error)) {
        throw error;
      }

      // Don't delay after the last attempt
      if (attempt < config.maxAttempts) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt - 1),
          config.maxDelayMs
        );

        if (config.onRetry) {
          config.onRetry(attempt, error, delay);
        }

        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Execute a function with retry and return a result object instead of throwing
 */
export async function tryWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: unknown;
  let attempts = 0;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    attempts = attempt;
    try {
      const data = await fn();
      return { success: true, data, attempts };
    } catch (error) {
      lastError = error;

      if (config.shouldRetry && !config.shouldRetry(error)) {
        return { success: false, error, attempts };
      }

      if (attempt < config.maxAttempts) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt - 1),
          config.maxDelayMs
        );

        if (config.onRetry) {
          config.onRetry(attempt, error, delay);
        }

        await sleep(delay);
      }
    }
  }

  return { success: false, error: lastError, attempts };
}

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (network errors, rate limits, server errors)
 */
export function isRetryableError(error: unknown): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // HTTP errors with retryable status codes
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    // Retry on rate limit (429), server errors (5xx)
    return status === 429 || (status >= 500 && status < 600);
  }

  // Default: retry on any error
  return true;
}

/**
 * Check if an HTTP response indicates a retryable error
 */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

// ============================================================================
// Specialized Retry Functions
// ============================================================================

/**
 * Retry configuration for WhatsApp API calls
 */
export const WHATSAPP_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
  shouldRetry: isRetryableError,
  onRetry: (attempt, error, delay) => {
    console.log(`📱 WhatsApp API retry ${attempt}, waiting ${delay}ms...`, error);
  },
};

/**
 * Retry configuration for OpenAI API calls
 */
export const OPENAI_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 2,
  baseDelayMs: 2000,
  maxDelayMs: 10000,
  shouldRetry: isRetryableError,
  onRetry: (attempt, error, delay) => {
    console.log(`🤖 OpenAI API retry ${attempt}, waiting ${delay}ms...`, error);
  },
};
