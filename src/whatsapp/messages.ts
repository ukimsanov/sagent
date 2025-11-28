/**
 * WhatsApp Cloud API message sending utilities
 * https://developers.facebook.com/docs/whatsapp/cloud-api/messages
 */

import type {
  SendTextMessageRequest,
  SendMessageResponse,
  SendInteractiveMessageRequest
} from './types';

// ============================================================================
// Constants
// ============================================================================

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

// ============================================================================
// Message Sending Functions
// ============================================================================

/**
 * Send a text message via WhatsApp Cloud API
 */
export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<SendMessageResponse> {
  const payload: SendTextMessageRequest = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body: text
    }
  };

  return sendMessage(phoneNumberId, accessToken, payload);
}

/**
 * Send an interactive message with buttons
 */
export async function sendButtonMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
): Promise<SendMessageResponse> {
  if (buttons.length > 3) {
    throw new Error('WhatsApp allows maximum 3 buttons per message');
  }

  const payload: SendInteractiveMessageRequest = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: bodyText
      },
      action: {
        buttons: buttons.map(btn => ({
          type: 'reply' as const,
          reply: {
            id: btn.id,
            title: btn.title.substring(0, 20) // Max 20 chars
          }
        }))
      }
    }
  };

  return sendMessage(phoneNumberId, accessToken, payload);
}

/**
 * Send an interactive list message
 */
export async function sendListMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>
): Promise<SendMessageResponse> {
  const payload: SendInteractiveMessageRequest = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: bodyText
      },
      action: {
        button: buttonText.substring(0, 20), // Max 20 chars
        sections: sections.map(section => ({
          title: section.title.substring(0, 24), // Max 24 chars
          rows: section.rows.map(row => ({
            id: row.id,
            title: row.title.substring(0, 24), // Max 24 chars
            description: row.description?.substring(0, 72) // Max 72 chars
          }))
        }))
      }
    }
  };

  return sendMessage(phoneNumberId, accessToken, payload);
}

/**
 * Mark a message as read
 */
export async function markAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
): Promise<void> {
  const url = `${WHATSAPP_API_URL}/${phoneNumberId}/messages`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    })
  });
}

/**
 * Send typing indicator (simulates human-like behavior)
 * Note: WhatsApp doesn't have a native typing indicator API
 * This is a placeholder - the actual "typing" effect is achieved
 * by adding a small delay before responding
 */
export async function simulateTypingDelay(textLength: number): Promise<void> {
  // Average typing speed: ~40 words per minute = ~200 chars per minute
  // So roughly 3.3 chars per second, or 300ms per char
  // We'll cap it at 3 seconds max to not be annoying
  const baseDelay = 500; // Minimum delay
  const typingDelay = Math.min(textLength * 15, 2500); // ~15ms per char, max 2.5s
  const totalDelay = baseDelay + typingDelay;

  await new Promise(resolve => setTimeout(resolve, totalDelay));
}

// ============================================================================
// Internal Functions
// ============================================================================

async function sendMessage(
  phoneNumberId: string,
  accessToken: string,
  payload: SendTextMessageRequest | SendInteractiveMessageRequest
): Promise<SendMessageResponse> {
  const url = `${WHATSAPP_API_URL}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new WhatsAppApiError(
      `Failed to send message: ${response.status}`,
      response.status,
      error
    );
  }

  return response.json();
}

// ============================================================================
// Error Handling
// ============================================================================

export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response: unknown
  ) {
    super(message);
    this.name = 'WhatsAppApiError';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format phone number to WhatsApp format (no + or spaces)
 */
export function formatPhoneNumber(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * Split long messages into chunks (WhatsApp limit is 4096 chars)
 */
export function splitMessage(text: string, maxLength: number = 4000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point (end of sentence or paragraph)
    let breakPoint = maxLength;
    const lastParagraph = remaining.lastIndexOf('\n\n', maxLength);
    const lastSentence = remaining.lastIndexOf('. ', maxLength);
    const lastSpace = remaining.lastIndexOf(' ', maxLength);

    if (lastParagraph > maxLength * 0.5) {
      breakPoint = lastParagraph + 2;
    } else if (lastSentence > maxLength * 0.5) {
      breakPoint = lastSentence + 2;
    } else if (lastSpace > maxLength * 0.5) {
      breakPoint = lastSpace + 1;
    }

    chunks.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }

  return chunks;
}
