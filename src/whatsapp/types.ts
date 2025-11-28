/**
 * WhatsApp Cloud API Types
 * Based on official Meta documentation (Oct 2025)
 * https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */

// ============================================================================
// Webhook Payload Types (Incoming)
// ============================================================================

/**
 * Root webhook payload from WhatsApp
 */
export interface WebhookPayload {
  object: 'whatsapp_business_account';
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string; // WhatsApp Business Account ID
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: 'messages';
}

export interface WebhookValue {
  messaging_product: 'whatsapp';
  metadata: WebhookMetadata;
  contacts?: WebhookContact[];
  messages?: IncomingMessage[];
  statuses?: MessageStatus[];
  errors?: WebhookError[];
}

export interface WebhookMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WebhookContact {
  profile: {
    name: string;
  };
  wa_id: string; // WhatsApp ID (phone number)
}

// ============================================================================
// Incoming Message Types
// ============================================================================

export interface IncomingMessageBase {
  from: string; // Sender's phone number
  id: string; // Message ID (wamid.xxx)
  timestamp: string; // Unix timestamp as string
}

export interface TextMessage extends IncomingMessageBase {
  type: 'text';
  text: {
    body: string;
  };
}

export interface ImageMessage extends IncomingMessageBase {
  type: 'image';
  image: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
}

export interface AudioMessage extends IncomingMessageBase {
  type: 'audio';
  audio: {
    id: string;
    mime_type: string;
    sha256?: string;
    voice?: boolean; // True if voice message
  };
}

export interface DocumentMessage extends IncomingMessageBase {
  type: 'document';
  document: {
    id: string;
    mime_type: string;
    sha256: string;
    filename?: string;
    caption?: string;
  };
}

export interface LocationMessage extends IncomingMessageBase {
  type: 'location';
  location: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

export interface InteractiveMessage extends IncomingMessageBase {
  type: 'interactive';
  interactive: {
    type: 'button_reply' | 'list_reply';
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
      description?: string;
    };
  };
}

export interface UnsupportedMessage extends IncomingMessageBase {
  type: 'unsupported';
  errors?: MessageError[];
}

export type IncomingMessage =
  | TextMessage
  | ImageMessage
  | AudioMessage
  | DocumentMessage
  | LocationMessage
  | InteractiveMessage
  | UnsupportedMessage;

// ============================================================================
// Message Status Types (Outgoing)
// ============================================================================

export interface MessageStatus {
  id: string; // Message ID
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin: {
      type: 'service' | 'marketing' | 'utility' | 'authentication' | 'referral_conversion';
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: MessageError[];
}

// ============================================================================
// Error Types
// ============================================================================

export interface WebhookError {
  code: number;
  title: string;
  message: string;
  error_data?: {
    details: string;
  };
}

export interface MessageError {
  code: number;
  title: string;
  message?: string;
  error_data?: {
    details: string;
  };
}

// ============================================================================
// Outgoing Message Types (Sending)
// ============================================================================

export interface SendTextMessageRequest {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: {
    preview_url?: boolean;
    body: string;
  };
}

export interface SendInteractiveMessageRequest {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button' | 'list';
    header?: {
      type: 'text' | 'image' | 'video' | 'document';
      text?: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: InteractiveAction;
  };
}

export interface InteractiveAction {
  buttons?: Array<{
    type: 'reply';
    reply: {
      id: string;
      title: string;
    };
  }>;
  button?: string;
  sections?: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
}

export interface SendReactionRequest {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'reaction';
  reaction: {
    message_id: string;
    emoji: string;
  };
}

export type SendMessageRequest =
  | SendTextMessageRequest
  | SendInteractiveMessageRequest
  | SendReactionRequest;

export interface SendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isTextMessage(message: IncomingMessage): message is TextMessage {
  return message.type === 'text';
}

export function isAudioMessage(message: IncomingMessage): message is AudioMessage {
  return message.type === 'audio';
}

export function isImageMessage(message: IncomingMessage): message is ImageMessage {
  return message.type === 'image';
}

export function isInteractiveMessage(message: IncomingMessage): message is InteractiveMessage {
  return message.type === 'interactive';
}

export function hasMessages(value: WebhookValue): boolean {
  return Array.isArray(value.messages) && value.messages.length > 0;
}

export function hasStatuses(value: WebhookValue): boolean {
  return Array.isArray(value.statuses) && value.statuses.length > 0;
}
