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

// Token-based limit instead of message count
// ~4 characters per token for English text
// 2000 tokens ≈ 8000 characters ≈ 20-40 typical messages
export const MAX_TOKENS = 2000;
export const CHARS_PER_TOKEN = 4;
export const CONVERSATION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * Estimate token count for a string (~4 chars per token for English)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Calculate total tokens for all messages
 */
export function calculateTotalTokens(messages: Message[]): number {
  return messages.reduce((total, msg) => total + estimateTokens(msg.content), 0);
}

/**
 * Check if adding a new message would exceed the token limit
 * This triggers summarization BEFORE we lose data
 */
export function wouldOverflow(conversation: ConversationState, newMessageContent: string): boolean {
  const currentTokens = calculateTotalTokens(conversation.messages);
  const newMessageTokens = estimateTokens(newMessageContent);
  return (currentTokens + newMessageTokens) > MAX_TOKENS;
}

/**
 * Get messages that would be trimmed if we added a new message
 * Returns the oldest messages that need to be summarized before they're lost
 */
export function getMessagesToSummarize(
  conversation: ConversationState,
  newMessageContent: string
): Message[] {
  const newMessageTokens = estimateTokens(newMessageContent);
  const targetTokens = MAX_TOKENS - newMessageTokens;

  // Find how many messages from the end we can keep
  let keptTokens = 0;
  let keepFromIndex = conversation.messages.length;

  for (let i = conversation.messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(conversation.messages[i].content);
    if (keptTokens + msgTokens <= targetTokens) {
      keptTokens += msgTokens;
      keepFromIndex = i;
    } else {
      break;
    }
  }

  // Return messages that would be trimmed (from start to keepFromIndex)
  return conversation.messages.slice(0, keepFromIndex);
}

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

  // Trim oldest messages until under token limit
  // This protects against long messages bloating the context
  while (calculateTotalTokens(conversation.messages) > MAX_TOKENS && conversation.messages.length > 1) {
    conversation.messages.shift(); // Remove oldest message
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
