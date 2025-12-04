/**
 * Reliable Message Sender with Retry Logic
 *
 * H3 FIX: Wraps WhatsApp message sending with retry + dead letter queue logging.
 * Prevents message loss from transient API failures.
 *
 * Uses existing retry.ts infrastructure with custom shouldRetry logic.
 */

import { sendTextMessage, sendImageMessage, WhatsAppApiError } from './messages';
import { tryWithRetry, WHATSAPP_RETRY_OPTIONS } from '../utils/retry';
import { logToDeadLetter } from '../db/dead-letter';

// ============================================================================
// Types
// ============================================================================

export interface SendContext {
  db: D1Database;
  phoneNumberId: string;
  accessToken: string;
  to: string;
  leadId: string;
  businessId: string;
  incomingMessageId?: string; // WhatsApp message ID that triggered this response
}

export interface ReliableSendResult {
  success: boolean;
  attempts: number;
  messageId?: string;
  error?: string;
}

// ============================================================================
// Reliable Send Functions
// ============================================================================

/**
 * Send a text message with automatic retry and dead letter queue logging.
 *
 * - Retries up to 3 times with exponential backoff
 * - Does NOT retry 4xx errors (except 429 rate limit)
 * - Logs to dead letter queue on permanent failure for manual recovery
 */
export async function sendTextMessageReliable(
  ctx: SendContext,
  text: string
): Promise<ReliableSendResult> {
  const result = await tryWithRetry(
    () => sendTextMessage(ctx.phoneNumberId, ctx.accessToken, ctx.to, text),
    {
      ...WHATSAPP_RETRY_OPTIONS,
      shouldRetry: (error) => shouldRetryWhatsAppError(error),
    }
  );

  if (result.success) {
    return {
      success: true,
      attempts: result.attempts,
      messageId: result.data?.messages?.[0]?.id,
    };
  }

  // Extract detailed error info for DLQ
  const errorDetails = extractErrorDetails(result.error);

  console.error(`📱 Message failed after ${result.attempts} attempts: ${errorDetails.message}`);

  try {
    await logToDeadLetter(ctx.db, 'message_send', ctx.leadId, errorDetails.message, {
      type: 'text',
      channel: 'whatsapp',
      businessId: ctx.businessId,
      to: ctx.to,
      incomingMessageId: ctx.incomingMessageId || null,
      text: text.substring(0, 500),
      attempts: result.attempts,
      errorStatus: errorDetails.statusCode,
      errorBody: errorDetails.responseBody,
    });
  } catch (dlqError) {
    // DLQ logging itself failed - log but don't throw
    console.error('Failed to log to dead letter queue:', dlqError);
  }

  return {
    success: false,
    attempts: result.attempts,
    error: errorDetails.message,
  };
}

/**
 * Send an image message with automatic retry and dead letter queue logging.
 */
export async function sendImageMessageReliable(
  ctx: SendContext,
  imageUrl: string,
  caption?: string
): Promise<ReliableSendResult> {
  const result = await tryWithRetry(
    () => sendImageMessage(ctx.phoneNumberId, ctx.accessToken, ctx.to, imageUrl, caption),
    {
      ...WHATSAPP_RETRY_OPTIONS,
      shouldRetry: (error) => shouldRetryWhatsAppError(error),
    }
  );

  if (result.success) {
    return {
      success: true,
      attempts: result.attempts,
      messageId: result.data?.messages?.[0]?.id,
    };
  }

  // Extract detailed error info for DLQ
  const errorDetails = extractErrorDetails(result.error);

  console.error(`📸 Image message failed after ${result.attempts} attempts: ${errorDetails.message}`);

  try {
    await logToDeadLetter(ctx.db, 'message_send', ctx.leadId, errorDetails.message, {
      type: 'image',
      channel: 'whatsapp',
      businessId: ctx.businessId,
      to: ctx.to,
      incomingMessageId: ctx.incomingMessageId || null,
      imageUrl: imageUrl.substring(0, 200),
      caption: caption?.substring(0, 100),
      attempts: result.attempts,
      errorStatus: errorDetails.statusCode,
      errorBody: errorDetails.responseBody,
    });
  } catch (dlqError) {
    console.error('Failed to log to dead letter queue:', dlqError);
  }

  return {
    success: false,
    attempts: result.attempts,
    error: errorDetails.message,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract detailed error info from a WhatsApp API error for DLQ logging.
 */
function extractErrorDetails(error: unknown): {
  message: string;
  statusCode: number | null;
  responseBody: string | null;
} {
  if (error instanceof WhatsAppApiError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      responseBody: typeof error.response === 'string'
        ? error.response.substring(0, 1000)
        : JSON.stringify(error.response).substring(0, 1000),
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: null,
      responseBody: null,
    };
  }

  return {
    message: 'Unknown error',
    statusCode: null,
    responseBody: null,
  };
}

/**
 * Determine if a WhatsApp API error should be retried.
 *
 * Retry:
 * - 429 Rate Limit
 * - 5xx Server Errors
 * - Network errors (TypeError from fetch)
 *
 * Don't retry:
 * - 400 Bad Request (malformed request)
 * - 401 Unauthorized (bad token)
 * - 403 Forbidden (not allowed)
 * - 404 Not Found (wrong phone number ID)
 */
function shouldRetryWhatsAppError(error: unknown): boolean {
  // Network errors - always retry
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // WhatsApp API errors with status codes
  if (error instanceof WhatsAppApiError) {
    // Retry rate limits
    if (error.statusCode === 429) {
      return true;
    }

    // Retry server errors
    if (error.statusCode >= 500 && error.statusCode < 600) {
      return true;
    }

    // Don't retry client errors (4xx except 429)
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return false;
    }
  }

  // Unknown error type - default to retry
  return true;
}

/**
 * Batch send multiple messages with reliability.
 * Useful for multi-part messages or message + images.
 */
export async function sendMessagesReliable(
  ctx: SendContext,
  messages: Array<{ type: 'text'; text: string } | { type: 'image'; url: string; caption?: string }>
): Promise<{ successes: number; failures: number; results: ReliableSendResult[] }> {
  const results: ReliableSendResult[] = [];
  let successes = 0;
  let failures = 0;

  for (const msg of messages) {
    let result: ReliableSendResult;

    if (msg.type === 'text') {
      result = await sendTextMessageReliable(ctx, msg.text);
    } else {
      result = await sendImageMessageReliable(ctx, msg.url, msg.caption);
    }

    results.push(result);

    if (result.success) {
      successes++;
    } else {
      failures++;
    }

    // Small delay between messages to avoid rate limits
    if (messages.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return { successes, failures, results };
}
