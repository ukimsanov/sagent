/**
 * WhatsApp AI Sales Agent - Cloudflare Worker Entry Point
 *
 * Handles:
 * - WhatsApp webhook verification (GET)
 * - Incoming message processing (POST)
 * - AI agent orchestration
 * - Response sending
 */

import {
  verifyWebhook,
  parseWebhookPayload,
  extractMessage,
  isStatusUpdate,
  type WebhookVerificationParams
} from './whatsapp/webhook';
import {
  sendTextMessage,
  markAsRead,
  simulateTypingDelay,
  splitMessage
} from './whatsapp/messages';
import { runAgent } from './ai/agent';
import * as db from './db/queries';
import {
  getConversation,
  addMessage,
  formatMessagesForLLM,
  updateLastResponseId
} from './utils/kv';

// ============================================================================
// Types
// ============================================================================

interface Env {
  // Bindings from wrangler.jsonc
  DB: D1Database;
  CONVERSATIONS: KVNamespace;

  // Environment variables
  WHATSAPP_VERIFY_TOKEN: string;

  // Secrets (set via wrangler secret put)
  OPENAI_API_KEY: string;
  WHATSAPP_ACCESS_TOKEN: string;
}

// ============================================================================
// Main Handler
// ============================================================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response('OK', { status: 200 });
    }

    // WhatsApp webhook endpoint
    if (url.pathname === '/webhook') {
      if (request.method === 'GET') {
        return handleWebhookVerification(request, env);
      }

      if (request.method === 'POST') {
        // Read body BEFORE returning response (can't read stream after response sent)
        const body = await request.json();
        // Process the message in the background
        ctx.waitUntil(handleIncomingMessage(body, env));
        // Respond immediately to WhatsApp (they require < 5s response)
        return new Response('OK', { status: 200 });
      }
    }

    // 404 for unknown routes
    return new Response('Not Found', { status: 404 });
  }
} satisfies ExportedHandler<Env>;

// ============================================================================
// Webhook Verification (GET /webhook)
// ============================================================================

function handleWebhookVerification(request: Request, env: Env): Response {
  const url = new URL(request.url);

  const params: WebhookVerificationParams = {
    mode: url.searchParams.get('hub.mode'),
    token: url.searchParams.get('hub.verify_token'),
    challenge: url.searchParams.get('hub.challenge')
  };

  return verifyWebhook(params, env.WHATSAPP_VERIFY_TOKEN);
}

// ============================================================================
// Incoming Message Handler (POST /webhook)
// ============================================================================

async function handleIncomingMessage(body: unknown, env: Env): Promise<void> {
  try {
    const payload = parseWebhookPayload(body);

    if (!payload) {
      console.log('Invalid webhook payload');
      return;
    }

    // Ignore status updates (sent, delivered, read)
    if (isStatusUpdate(payload)) {
      console.log('Ignoring status update');
      return;
    }

    // Extract the message
    const message = extractMessage(payload);
    if (!message) {
      console.log('No message to process');
      return;
    }

    // Only handle text messages for now
    if (!message.text) {
      console.log(`Ignoring non-text message type: ${message.type}`);
      // TODO: Handle audio messages with transcription
      return;
    }

    // At this point we know text is not null
    const textMessage = {
      businessPhoneNumberId: message.businessPhoneNumberId,
      from: message.from,
      fromName: message.fromName,
      text: message.text // Now guaranteed to be string
    };

    console.log(`Processing message from ${textMessage.from}: ${textMessage.text}`);

    // Mark as read immediately
    await markAsRead(
      textMessage.businessPhoneNumberId,
      env.WHATSAPP_ACCESS_TOKEN,
      message.messageId
    );

    // Get business config
    const business = await db.getBusinessByPhoneId(env.DB, textMessage.businessPhoneNumberId);
    if (!business) {
      console.error(`No business found for phone ID: ${textMessage.businessPhoneNumberId}`);
      // For demo, fall back to demo business
      const demoBusiness = await db.getBusinessById(env.DB, 'demo-store-001');
      if (!demoBusiness) {
        console.error('Demo business not found. Please seed the database.');
        return;
      }
      // Continue with demo business
      await processMessage(env, demoBusiness, textMessage);
      return;
    }

    await processMessage(env, business, textMessage);
  } catch (error) {
    console.error('Error handling incoming message:', error);
  }
}

// ============================================================================
// Message Processing
// ============================================================================

async function processMessage(
  env: Env,
  business: db.Business,
  message: {
    businessPhoneNumberId: string;
    from: string;
    fromName: string;
    text: string;
  }
): Promise<void> {
  // Get or create lead
  const lead = await db.getOrCreateLead(env.DB, business.id, message.from);

  // Update lead name if we got it from WhatsApp
  if (message.fromName && message.fromName !== 'Unknown' && !lead.name) {
    await db.updateLeadName(env.DB, lead.id, message.fromName);
    lead.name = message.fromName;
  }

  // Get conversation summary (previous context)
  const conversationSummary = await db.getConversationSummary(env.DB, lead.id);

  // Get recent conversation history from KV
  const conversation = await getConversation(
    env.CONVERSATIONS,
    business.id,
    message.from,
    lead.id
  );

  // Add user message to conversation
  await addMessage(
    env.CONVERSATIONS,
    business.id,
    message.from,
    lead.id,
    { role: 'user', content: message.text }
  );

  // Run the AI agent with caching options
  const agentResponse = await runAgent(
    env.OPENAI_API_KEY,
    env.DB,
    {
      business,
      lead,
      conversationSummary,
      conversationHistory: formatMessagesForLLM(conversation)
    },
    message.text,
    {
      // Use previous response ID for conversation chaining (reduces tokens)
      previousResponseId: conversation.lastResponseId,
      // Use business ID for prompt cache key (better cache hits per business)
      promptCacheKey: business.id
    }
  );

  console.log('Agent response:', {
    messageLength: agentResponse.message.length,
    toolsCalled: agentResponse.toolsCalled,
    leadScoreChange: agentResponse.leadScoreChange,
    flaggedForHuman: agentResponse.flaggedForHuman,
    responseId: agentResponse.responseId
  });

  // Store the response ID for future conversation chaining
  await updateLastResponseId(
    env.CONVERSATIONS,
    business.id,
    message.from,
    lead.id,
    agentResponse.responseId
  );

  // Add a small delay to seem more human
  await simulateTypingDelay(agentResponse.message.length);

  // Split long messages if needed
  const messageParts = splitMessage(agentResponse.message);

  // Send response(s)
  for (const part of messageParts) {
    await sendTextMessage(
      message.businessPhoneNumberId,
      env.WHATSAPP_ACCESS_TOKEN,
      message.from,
      part
    );

    // Small delay between multiple messages
    if (messageParts.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Save assistant response to conversation
  await addMessage(
    env.CONVERSATIONS,
    business.id,
    message.from,
    lead.id,
    { role: 'assistant', content: agentResponse.message }
  );
}
