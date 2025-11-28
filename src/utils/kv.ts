/**
 * KV Storage utilities for conversation history
 * Stores recent messages for context in LLM calls
 */

// ============================================================================
// Types
// ============================================================================

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ConversationState {
  messages: Message[];
  lastUpdated: number;
  leadId: string;
  lastResponseId?: string; // OpenAI response ID for previous_response_id chaining
}

// ============================================================================
// Constants
// ============================================================================

const MAX_MESSAGES = 20; // Keep last 20 messages for context
const CONVERSATION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

// ============================================================================
// Functions
// ============================================================================

/**
 * Get conversation key for KV storage
 */
function getConversationKey(businessId: string, whatsappNumber: string): string {
  return `conv:${businessId}:${whatsappNumber}`;
}

/**
 * Get existing conversation or initialize a new one
 */
export async function getConversation(
  kv: KVNamespace,
  businessId: string,
  whatsappNumber: string,
  leadId: string
): Promise<ConversationState> {
  const key = getConversationKey(businessId, whatsappNumber);
  const stored = await kv.get<ConversationState>(key, 'json');

  if (stored) {
    return {
      ...stored,
      leadId // Always use current lead ID
    };
  }

  return {
    messages: [],
    lastUpdated: Date.now(),
    leadId
  };
}

/**
 * Add a message to the conversation and save
 */
export async function addMessage(
  kv: KVNamespace,
  businessId: string,
  whatsappNumber: string,
  leadId: string,
  message: Omit<Message, 'timestamp'>
): Promise<ConversationState> {
  const conversation = await getConversation(kv, businessId, whatsappNumber, leadId);

  const newMessage: Message = {
    ...message,
    timestamp: Date.now()
  };

  conversation.messages.push(newMessage);

  // Trim to max messages
  if (conversation.messages.length > MAX_MESSAGES) {
    conversation.messages = conversation.messages.slice(-MAX_MESSAGES);
  }

  conversation.lastUpdated = Date.now();

  // Save to KV
  const key = getConversationKey(businessId, whatsappNumber);
  await kv.put(key, JSON.stringify(conversation), {
    expirationTtl: CONVERSATION_TTL
  });

  return conversation;
}

/**
 * Get messages formatted for OpenAI API
 */
export function formatMessagesForLLM(
  conversation: ConversationState
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return conversation.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

/**
 * Clear conversation history
 */
export async function clearConversation(
  kv: KVNamespace,
  businessId: string,
  whatsappNumber: string
): Promise<void> {
  const key = getConversationKey(businessId, whatsappNumber);
  await kv.delete(key);
}

/**
 * Get conversation age in hours
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
 * Update the last OpenAI response ID for conversation chaining
 */
export async function updateLastResponseId(
  kv: KVNamespace,
  businessId: string,
  whatsappNumber: string,
  leadId: string,
  responseId: string
): Promise<void> {
  const conversation = await getConversation(kv, businessId, whatsappNumber, leadId);
  conversation.lastResponseId = responseId;
  conversation.lastUpdated = Date.now();

  const key = getConversationKey(businessId, whatsappNumber);
  await kv.put(key, JSON.stringify(conversation), {
    expirationTtl: CONVERSATION_TTL
  });
}
