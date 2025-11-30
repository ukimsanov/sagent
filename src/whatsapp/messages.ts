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
 * Mark a message as read and optionally show typing indicator
 * When showTypingIndicator is true, the typing indicator will show
 * and auto-dismiss after 25 seconds or when a message is sent
 */
export async function markAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string,
  showTypingIndicator: boolean = false
): Promise<void> {
  const url = `${WHATSAPP_API_URL}/${phoneNumberId}/messages`;

  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId
  };

  // Add typing indicator if requested
  // Meta added this capability in October 2024
  if (showTypingIndicator) {
    payload.typing_indicator = {
      type: 'text'
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`Message marked as read${showTypingIndicator ? ' with typing indicator' : ''}`);
    } else {
      const errorBody = await response.text();
      console.error('Mark as read failed:', response.status, errorBody);
    }
  } catch (error) {
    console.error('Failed to mark as read:', error);
  }
}


/**
 * Simulate typing delay (backup for when typing indicator is not enough)
 * Only adds a small delay now since we use real typing indicators
 */
export async function simulateTypingDelay(textLength: number): Promise<void> {
  // With real typing indicators, we only need a small delay
  // to make the response feel natural (not instant)
  const delay = Math.min(200 + textLength * 5, 800); // 200-800ms
  await new Promise(resolve => setTimeout(resolve, delay));
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
