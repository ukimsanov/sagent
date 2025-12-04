/**
 * Conversation Durable Object Client
 *
 * Provides the same interface as kv.ts but backed by Durable Objects.
 * This is a drop-in replacement that provides atomic, serialized access.
 *
 * Migration: Replace KVNamespace with DurableObjectNamespace in callers.
 */

// ============================================================================
// Types (re-exported from ConversationDO)
// ============================================================================

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  id?: string;
}

export interface ConversationState {
  messages: Message[];
  lastUpdated: number;
  leadId: string;
  lastResponseId?: string;
}

// ============================================================================
// Constants (matching kv.ts for compatibility)
// ============================================================================

export const MAX_TOKENS = 2000;
export const CHARS_PER_TOKEN = 4;

// ============================================================================
// Token Utilities (re-exported for compatibility)
// ============================================================================

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function calculateTotalTokens(messages: Message[]): number {
  return messages.reduce((total, msg) => total + estimateTokens(msg.content), 0);
}

// ============================================================================
// DO Client Functions
// ============================================================================

/**
 * Get conversation stub for a specific business + phone number
 */
function getConversationStub(
  doNamespace: DurableObjectNamespace,
  businessId: string,
  whatsappNumber: string
): DurableObjectStub {
  // Create deterministic ID from business + phone
  const id = doNamespace.idFromName(`${businessId}:${whatsappNumber}`);
  return doNamespace.get(id);
}

/**
 * Get existing conversation or initialize a new one
 *
 * Drop-in replacement for kv.ts getConversation()
 */
export async function getConversation(
  doNamespace: DurableObjectNamespace,
  businessId: string,
  whatsappNumber: string,
  leadId: string
): Promise<ConversationState> {
  const stub = getConversationStub(doNamespace, businessId, whatsappNumber);

  const response = await stub.fetch('http://conversation.do/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'getConversation',
      leadId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('DO getConversation failed:', error);
    // Return empty conversation on error (fail-safe)
    return {
      messages: [],
      lastUpdated: Date.now(),
      leadId,
    };
  }

  const result = (await response.json()) as { state: ConversationState };
  return result.state;
}

/**
 * Add a message to the conversation
 *
 * Drop-in replacement for kv.ts addMessage()
 * Now atomic - no race conditions possible.
 */
export async function addMessage(
  doNamespace: DurableObjectNamespace,
  businessId: string,
  whatsappNumber: string,
  leadId: string,
  message: Omit<Message, 'timestamp'>,
  messageId?: string
): Promise<ConversationState> {
  const stub = getConversationStub(doNamespace, businessId, whatsappNumber);

  const response = await stub.fetch('http://conversation.do/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'addMessage',
      leadId,
      message,
      messageId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('DO addMessage failed:', error);
    throw new Error(`Failed to add message: ${error}`);
  }

  const result = (await response.json()) as {
    success: boolean;
    duplicate?: boolean;
    state: ConversationState;
  };

  if (result.duplicate) {
    console.log(`DO client: Message ${messageId} was duplicate, returning existing state`);
  }

  return result.state;
}

/**
 * Get messages formatted for OpenAI API
 *
 * Same as kv.ts formatMessagesForLLM()
 */
export function formatMessagesForLLM(
  conversation: ConversationState
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return conversation.messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Clear conversation history
 *
 * Drop-in replacement for kv.ts clearConversation()
 */
export async function clearConversation(
  doNamespace: DurableObjectNamespace,
  businessId: string,
  whatsappNumber: string
): Promise<void> {
  const stub = getConversationStub(doNamespace, businessId, whatsappNumber);

  const response = await stub.fetch('http://conversation.do/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'clear' }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('DO clearConversation failed:', error);
  }
}

/**
 * Update the last OpenAI response ID for conversation chaining
 *
 * Drop-in replacement for kv.ts updateLastResponseId()
 */
export async function updateLastResponseId(
  doNamespace: DurableObjectNamespace,
  businessId: string,
  whatsappNumber: string,
  leadId: string,
  responseId: string
): Promise<void> {
  const stub = getConversationStub(doNamespace, businessId, whatsappNumber);

  const response = await stub.fetch('http://conversation.do/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'updateResponseId',
      leadId,
      responseId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('DO updateLastResponseId failed:', error);
  }
}

/**
 * Get conversation age in hours
 *
 * Same as kv.ts getConversationAge()
 */
export function getConversationAge(conversation: ConversationState): number {
  if (conversation.messages.length === 0) {
    return 0;
  }

  const firstMessage = conversation.messages[0];
  const ageMs = Date.now() - firstMessage.timestamp;
  return ageMs / (1000 * 60 * 60);
}

/**
 * Check if adding a new message would exceed the token limit
 *
 * Same as kv.ts wouldOverflow()
 */
export function wouldOverflow(conversation: ConversationState, newMessageContent: string): boolean {
  const currentTokens = calculateTotalTokens(conversation.messages);
  const newMessageTokens = estimateTokens(newMessageContent);
  return currentTokens + newMessageTokens > MAX_TOKENS;
}

/**
 * Get messages that would be trimmed if we added a new message
 *
 * Calls DO for atomic operation.
 */
export async function getMessagesToSummarize(
  doNamespace: DurableObjectNamespace,
  businessId: string,
  whatsappNumber: string,
  newMessageContent: string
): Promise<{ messages: Message[]; wouldOverflow: boolean }> {
  const stub = getConversationStub(doNamespace, businessId, whatsappNumber);

  const response = await stub.fetch('http://conversation.do/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'getMessagesToSummarize',
      newMessageContent,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('DO getMessagesToSummarize failed:', error);
    return { messages: [], wouldOverflow: false };
  }

  return (await response.json()) as { messages: Message[]; wouldOverflow: boolean };
}
