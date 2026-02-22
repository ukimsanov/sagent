/**
 * WhatsApp Webhook Handler
 * Handles verification and incoming message webhooks
 */

import type {
  WebhookPayload,
  WebhookValue,
  IncomingMessage,
  TextMessage,
  hasMessages,
  isTextMessage
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface WebhookVerificationParams {
  mode: string | null;
  token: string | null;
  challenge: string | null;
}

export interface ParsedWebhookMessage {
  businessPhoneNumberId: string;
  from: string;
  fromName: string;
  messageId: string;
  timestamp: number;
  type: IncomingMessage['type'];
  text: string | null;
  raw: IncomingMessage;
  interactiveReply?: {
    type: 'button_reply' | 'list_reply';
    id: string;
    title: string;
    description?: string;
  };
}

// ============================================================================
// Webhook Verification (GET request)
// ============================================================================

/**
 * Verify webhook subscription from Meta
 * Called when setting up the webhook URL in Meta Developer Console
 */
export function verifyWebhook(
  params: WebhookVerificationParams,
  verifyToken: string
): Response {
  const { mode, token, challenge } = params;

  // Check if all required params are present
  if (!mode || !token || !challenge) {
    console.log('Webhook verification failed: missing parameters');
    return new Response('Missing parameters', { status: 400 });
  }

  // Check if mode is 'subscribe' and token matches
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Webhook verified successfully');
    return new Response(challenge, { status: 200 });
  }

  console.log('Webhook verification failed: token mismatch');
  return new Response('Verification failed', { status: 403 });
}

// ============================================================================
// Webhook Payload Parsing (POST request)
// ============================================================================

/**
 * Parse and validate incoming webhook payload
 */
export function parseWebhookPayload(payload: unknown): WebhookPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const p = payload as Record<string, unknown>;

  if (p.object !== 'whatsapp_business_account') {
    return null;
  }

  if (!Array.isArray(p.entry) || p.entry.length === 0) {
    return null;
  }

  return payload as WebhookPayload;
}

/**
 * Extract message from webhook payload
 */
export function extractMessage(payload: WebhookPayload): ParsedWebhookMessage | null {
  try {
    // Navigate to the message
    const entry = payload.entry[0];
    if (!entry?.changes?.[0]) return null;

    const change = entry.changes[0];
    const value = change.value;

    // Check if this is a message webhook (not status update)
    if (!value.messages || value.messages.length === 0) {
      return null;
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    // Extract text content based on message type
    let text: string | null = null;
    let interactiveReply: ParsedWebhookMessage['interactiveReply'] | undefined;

    switch (message.type) {
      case 'text':
        text = (message as TextMessage).text.body;
        break;
      case 'interactive':
        // Handle button/list replies — capture full ID + title
        if ('interactive' in message) {
          const interactive = message.interactive;
          if (interactive.button_reply) {
            text = interactive.button_reply.title;
            interactiveReply = {
              type: 'button_reply',
              id: interactive.button_reply.id,
              title: interactive.button_reply.title,
            };
          } else if (interactive.list_reply) {
            text = interactive.list_reply.title;
            interactiveReply = {
              type: 'list_reply',
              id: interactive.list_reply.id,
              title: interactive.list_reply.title,
              description: interactive.list_reply.description,
            };
          }
        }
        break;
      // For other types, we'll handle them later (audio, image, etc.)
      default:
        text = null;
    }

    return {
      businessPhoneNumberId: value.metadata.phone_number_id,
      from: message.from,
      fromName: contact?.profile?.name || 'Unknown',
      messageId: message.id,
      timestamp: parseInt(message.timestamp, 10),
      type: message.type,
      text,
      raw: message,
      interactiveReply,
    };
  } catch (error) {
    console.error('Error extracting message:', error);
    return null;
  }
}

/**
 * Check if webhook is a status update (not a new message)
 */
export function isStatusUpdate(payload: WebhookPayload): boolean {
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  return Boolean(value?.statuses && value.statuses.length > 0);
}

// ============================================================================
// Security
// ============================================================================

/**
 * Verify webhook signature from Meta
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
 *
 * Note: For production, you should verify the X-Hub-Signature-256 header
 * This requires the app secret from Meta Developer Console
 */
export async function verifySignature(
  payload: string,
  signature: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signature) {
    return false;
  }

  // Signature format: sha256=<hash>
  const [algorithm, hash] = signature.split('=');

  if (algorithm !== 'sha256' || !hash) {
    return false;
  }

  // Create HMAC SHA256 hash
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  // Convert to hex string
  const expectedHash = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison
  return timingSafeEqual(hash, expectedHash);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
