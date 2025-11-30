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
  verifySignature,
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
import { buildSummaryExtractionPrompt } from './ai/prompts';
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
  WHATSAPP_APP_SECRET?: string; // Optional - enables webhook signature validation
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
        // Read body as text first (needed for signature verification)
        const bodyText = await request.text();

        // Verify webhook signature if app secret is configured
        if (env.WHATSAPP_APP_SECRET) {
          const signature = request.headers.get('X-Hub-Signature-256');
          const isValid = await verifySignature(bodyText, signature, env.WHATSAPP_APP_SECRET);

          if (!isValid) {
            console.error('Invalid webhook signature - rejecting request');
            return new Response('Invalid signature', { status: 401 });
          }
          console.log('Webhook signature verified');
        }

        // Parse the body as JSON
        const body = JSON.parse(bodyText);

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

    // Mark as read immediately (shows blue checkmarks)
    await markAsRead(
      textMessage.businessPhoneNumberId,
      env.WHATSAPP_ACCESS_TOKEN,
      message.messageId,
      false // Don't show typing yet
    );

    // Natural "reading" delay before typing starts (1-2 seconds based on message length)
    const readingDelay = Math.min(1000 + textMessage.text.length * 20, 2500);
    await new Promise(resolve => setTimeout(resolve, readingDelay));

    // Now show typing indicator (auto-dismisses when we send response or after 25 seconds)
    await markAsRead(
      textMessage.businessPhoneNumberId,
      env.WHATSAPP_ACCESS_TOKEN,
      message.messageId,
      true // showTypingIndicator
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
  // Note: Typing indicator was already shown when we marked the message as read
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
  const updatedConversation = await addMessage(
    env.CONVERSATIONS,
    business.id,
    message.from,
    lead.id,
    { role: 'assistant', content: agentResponse.message }
  );

  // Summarize conversation in background if we have enough messages
  if (updatedConversation.messages.length >= 4) {
    summarizeConversation(env, lead.id, updatedConversation.messages).catch(err => {
      console.error('Background summarization failed:', err);
    });
  }
}

// ============================================================================
// Conversation Summarization (Background Task)
// ============================================================================

async function summarizeConversation(
  env: Env,
  leadId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<void> {
  try {
    console.log(`Summarizing conversation for lead ${leadId} (${messages.length} messages)`);

    // Build the prompt for extraction
    const prompt = buildSummaryExtractionPrompt(messages);

    // Call OpenAI to extract summary (using a simple completion, not the agent)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Summarization API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = result.choices[0]?.message?.content;
    if (!content) {
      console.error('Summarization returned no content');
      throw new Error('No content in OpenAI response');
    }

    console.log('Summarization raw response:', content.substring(0, 200));

    // Parse the JSON response
    const extracted = JSON.parse(content) as {
      summary: string;
      key_interests: string[];
      objections: string[];
      next_steps: string | null;
    };

    // Store the summary
    await db.upsertConversationSummary(
      env.DB,
      leadId,
      extracted.summary,
      extracted.key_interests || [],
      extracted.objections || [],
      extracted.next_steps
    );

    console.log(`Conversation summary saved for lead ${leadId}`);
  } catch (error) {
    console.error('Failed to summarize conversation:', error);
  }
}
