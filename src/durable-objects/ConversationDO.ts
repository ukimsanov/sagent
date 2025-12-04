/**
 * Conversation Durable Object
 *
 * Provides atomic, serialized access to conversation state.
 * Fixes C4: KV Read-Modify-Write Race Condition.
 *
 * Why Durable Objects:
 * - KV is eventually consistent with "last write wins"
 * - Concurrent messages from same user can corrupt conversation
 * - Durable Objects serialize all access to a single instance
 *
 * Sources:
 * - https://developers.cloudflare.com/durable-objects/
 * - https://developers.cloudflare.com/durable-objects/api/storage-api/
 */

import { DurableObject } from 'cloudflare:workers';

// ============================================================================
// Types (matching kv.ts interface)
// ============================================================================

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  id?: string; // WhatsApp message ID for dedup
}

export interface ConversationState {
  messages: Message[];
  lastUpdated: number;
  leadId: string;
  lastResponseId?: string; // OpenAI response ID for chaining
}

// Request types for DO communication
interface AddMessageRequest {
  type: 'addMessage';
  leadId: string;
  message: Omit<Message, 'timestamp'>;
  messageId?: string;
}

interface GetConversationRequest {
  type: 'getConversation';
  leadId: string;
}

interface ClearRequest {
  type: 'clear';
}

interface UpdateResponseIdRequest {
  type: 'updateResponseId';
  leadId: string;
  responseId: string;
}

interface GetMessagesToSummarizeRequest {
  type: 'getMessagesToSummarize';
  newMessageContent: string;
}

type DORequest =
  | AddMessageRequest
  | GetConversationRequest
  | ClearRequest
  | UpdateResponseIdRequest
  | GetMessagesToSummarizeRequest;

// Response types
interface AddMessageResponse {
  success: boolean;
  duplicate?: boolean;
  state: ConversationState;
}

interface GetConversationResponse {
  state: ConversationState;
}

interface ClearResponse {
  success: boolean;
}

interface UpdateResponseIdResponse {
  success: boolean;
}

interface GetMessagesToSummarizeResponse {
  messages: Message[];
  wouldOverflow: boolean;
}

// ============================================================================
// Constants (matching kv.ts)
// ============================================================================

const MAX_TOKENS = 2000;
const CHARS_PER_TOKEN = 4;

// ============================================================================
// Token Utilities
// ============================================================================

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function calculateTotalTokens(messages: Message[]): number {
  return messages.reduce((total, msg) => total + estimateTokens(msg.content), 0);
}

// ============================================================================
// Durable Object Class
// ============================================================================

/**
 * ConversationDO - Atomically manages conversation state
 *
 * Each instance is keyed by `${businessId}:${whatsappNumber}`
 * All operations are serialized - no race conditions possible.
 */
export class ConversationDO extends DurableObject {
  /**
   * Handle incoming requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as DORequest;

      switch (body.type) {
        case 'addMessage':
          return this.handleAddMessage(body);
        case 'getConversation':
          return this.handleGetConversation(body);
        case 'clear':
          return this.handleClear();
        case 'updateResponseId':
          return this.handleUpdateResponseId(body);
        case 'getMessagesToSummarize':
          return this.handleGetMessagesToSummarize(body);
        default:
          return Response.json({ error: 'Unknown request type' }, { status: 400 });
      }
    } catch (err) {
      console.error('ConversationDO error:', err);
      return Response.json(
        { error: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  /**
   * Get current conversation state or initialize empty
   */
  private async getState(leadId: string): Promise<ConversationState> {
    const state = await this.ctx.storage.get<ConversationState>('state');

    if (state) {
      return {
        ...state,
        leadId, // Always use current lead ID
      };
    }

    return {
      messages: [],
      lastUpdated: Date.now(),
      leadId,
    };
  }

  /**
   * Save conversation state to storage
   */
  private async saveState(state: ConversationState): Promise<void> {
    state.lastUpdated = Date.now();
    await this.ctx.storage.put('state', state);
  }

  /**
   * Handle addMessage request
   *
   * This is the key fix: all access is serialized by the Durable Object,
   * so there's no race condition even with concurrent requests.
   */
  private async handleAddMessage(req: AddMessageRequest): Promise<Response> {
    const state = await this.getState(req.leadId);

    // Dedup check - atomic within the DO
    if (req.messageId) {
      const exists = state.messages.some((m) => m.id === req.messageId);
      if (exists) {
        console.log(`DO: Message ${req.messageId} already exists, skipping duplicate`);
        return Response.json({
          success: true,
          duplicate: true,
          state,
        } as AddMessageResponse);
      }
    }

    // Add the new message
    const newMessage: Message = {
      ...req.message,
      timestamp: Date.now(),
      id: req.messageId,
    };

    state.messages.push(newMessage);

    // Trim oldest messages until under token limit
    while (calculateTotalTokens(state.messages) > MAX_TOKENS && state.messages.length > 1) {
      state.messages.shift();
    }

    await this.saveState(state);

    return Response.json({
      success: true,
      duplicate: false,
      state,
    } as AddMessageResponse);
  }

  /**
   * Handle getConversation request
   */
  private async handleGetConversation(req: GetConversationRequest): Promise<Response> {
    const state = await this.getState(req.leadId);
    return Response.json({ state } as GetConversationResponse);
  }

  /**
   * Handle clear request - delete all conversation data
   */
  private async handleClear(): Promise<Response> {
    await this.ctx.storage.delete('state');
    return Response.json({ success: true } as ClearResponse);
  }

  /**
   * Handle updateResponseId request
   */
  private async handleUpdateResponseId(req: UpdateResponseIdRequest): Promise<Response> {
    const state = await this.getState(req.leadId);
    state.lastResponseId = req.responseId;
    await this.saveState(state);
    return Response.json({ success: true } as UpdateResponseIdResponse);
  }

  /**
   * Handle getMessagesToSummarize request
   * Returns messages that would be trimmed if a new message is added
   */
  private async handleGetMessagesToSummarize(
    req: GetMessagesToSummarizeRequest
  ): Promise<Response> {
    const state = await this.ctx.storage.get<ConversationState>('state');

    if (!state || state.messages.length === 0) {
      return Response.json({
        messages: [],
        wouldOverflow: false,
      } as GetMessagesToSummarizeResponse);
    }

    const newMessageTokens = estimateTokens(req.newMessageContent);
    const currentTokens = calculateTotalTokens(state.messages);
    const wouldOverflow = currentTokens + newMessageTokens > MAX_TOKENS;

    if (!wouldOverflow) {
      return Response.json({
        messages: [],
        wouldOverflow: false,
      } as GetMessagesToSummarizeResponse);
    }

    // Find how many messages from the end we can keep
    const targetTokens = MAX_TOKENS - newMessageTokens;
    let keptTokens = 0;
    let keepFromIndex = state.messages.length;

    for (let i = state.messages.length - 1; i >= 0; i--) {
      const msgTokens = estimateTokens(state.messages[i].content);
      if (keptTokens + msgTokens <= targetTokens) {
        keptTokens += msgTokens;
        keepFromIndex = i;
      } else {
        break;
      }
    }

    // Return messages that would be trimmed
    return Response.json({
      messages: state.messages.slice(0, keepFromIndex),
      wouldOverflow: true,
    } as GetMessagesToSummarizeResponse);
  }
}
