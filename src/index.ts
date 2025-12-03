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
import { isAudioMessage } from './whatsapp/types';
import {
  sendTextMessage,
  markAsRead,
  simulateTypingDelay,
  splitMessage
} from './whatsapp/messages';
import { handleIncomingMessage as handleMessage } from './ai/handler';
import { buildIncrementalSummaryPrompt } from './ai/prompts';
import { transcribeAudioMessage } from './ai/transcription';
import * as db from './db/queries';
import {
  getConversation,
  addMessage,
  formatMessagesForLLM,
  wouldOverflow,
  type Message
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

    // Cleanup endpoint for testing (removes all data for a specific WhatsApp number)
    if (url.pathname === '/cleanup' && request.method === 'POST') {
      return handleCleanup(request, env);
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
        ctx.waitUntil(handleIncomingMessage(body, env, ctx));
        // Respond immediately to WhatsApp (they require < 5s response)
        return new Response('OK', { status: 200 });
      }
    }

    // 404 for unknown routes
    return new Response('Not Found', { status: 404 });
  }
} satisfies ExportedHandler<Env>;

// ============================================================================
// Cleanup Endpoint (POST /cleanup) - For Testing
// ============================================================================

async function handleCleanup(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { whatsapp_number?: string; secret?: string };
    const whatsappNumber = body.whatsapp_number;
    const secret = body.secret;

    // Simple auth check
    if (secret !== 'DELETE_MY_DATA_123') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!whatsappNumber) {
      return new Response(JSON.stringify({ error: 'whatsapp_number required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`🧹 Cleanup requested for WhatsApp number: ${whatsappNumber}`);

    // Find lead(s) with this WhatsApp number
    const leads = await env.DB
      .prepare('SELECT id, business_id FROM leads WHERE whatsapp_number = ?')
      .bind(whatsappNumber)
      .all();

    if (!leads.results || leads.results.length === 0) {
      console.log('No data found for this number');
      return new Response(JSON.stringify({
        success: true,
        message: 'No data found for this number',
        deleted: 0
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let deletedCount = 0;

    for (const lead of leads.results) {
      const leadId = (lead as any).id;
      const businessId = (lead as any).business_id;

      console.log(`Deleting data for lead: ${leadId}`);

      // Delete from D1 in batch
      await env.DB.batch([
        env.DB.prepare('DELETE FROM conversation_summaries WHERE lead_id = ?').bind(leadId),
        env.DB.prepare('DELETE FROM human_flags WHERE lead_id = ?').bind(leadId),
        env.DB.prepare('DELETE FROM appointments WHERE lead_id = ?').bind(leadId),
        env.DB.prepare('DELETE FROM callback_requests WHERE lead_id = ?').bind(leadId),
        env.DB.prepare('DELETE FROM leads WHERE id = ?').bind(leadId)
      ]);

      // Delete from KV (conversation history)
      const kvKey = `conv:${businessId}:${whatsappNumber}:${leadId}`;
      await env.CONVERSATIONS.delete(kvKey);
      console.log(`Deleted KV key: ${kvKey}`);

      deletedCount++;
    }

    console.log(`✅ Cleanup complete: deleted ${deletedCount} lead record(s)`);

    return new Response(JSON.stringify({
      success: true,
      message: `Deleted ${deletedCount} lead record(s) and all related data`,
      deleted: deletedCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

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

async function handleIncomingMessage(body: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
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

    // Handle text OR audio messages
    if (message.text) {
      // Text message - process directly
      const textMessage = {
        businessPhoneNumberId: message.businessPhoneNumberId,
        from: message.from,
        fromName: message.fromName,
        text: message.text
      };

      console.log(`Processing text message from ${textMessage.from}: ${textMessage.text}`);

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
        await processMessage(env, ctx, demoBusiness, textMessage);
        return;
      }

      await processMessage(env, ctx, business, textMessage);

    } else if (message.type === 'audio' && isAudioMessage(message.raw)) {
      // Audio message - transcribe first, then process
      console.log(`Processing audio message from ${message.from}`);
      await processAudioMessage(env, ctx, message);

    } else {
      console.log(`Ignoring message type: ${message.type}`);
      return;
    }
  } catch (error) {
    console.error('Error handling incoming message:', error);
  }
}

// ============================================================================
// Message Processing
// ============================================================================

async function processMessage(
  env: Env,
  ctx: ExecutionContext,
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

  // Get recent conversation history from KV
  const conversation = await getConversation(
    env.CONVERSATIONS,
    business.id,
    message.from,
    lead.id
  );

  // Get existing conversation summary
  let conversationSummary = await db.getConversationSummary(env.DB, lead.id);

  // Check if adding this message would overflow KV storage
  // If so, summarize ALL current messages to preserve context
  // KV will naturally keep recent messages (with overlap) - that's fine and preferred for accuracy
  if (wouldOverflow(conversation, message.text) && conversation.messages.length >= 2) {
    console.log(`KV would overflow - summarizing all ${conversation.messages.length} messages to preserve context`);
    await summarizeConversation(env, lead.id, conversation.messages, conversationSummary);

    // Refresh summary after update
    conversationSummary = await db.getConversationSummary(env.DB, lead.id);
  }

  // Add user message to conversation (trimming happens automatically in addMessage)
  await addMessage(
    env.CONVERSATIONS,
    business.id,
    message.from,
    lead.id,
    { role: 'user', content: message.text }
  );

  // Process message with code-first handler
  const response = await handleMessage({
    db: env.DB,
    businessId: business.id,
    business,
    lead,
    messageText: message.text,
    openaiApiKey: env.OPENAI_API_KEY,
    conversationHistory: formatMessagesForLLM(conversation),
    conversationSummary
  });

  console.log('Agent response:', {
    messageLength: response.message.length,
    flaggedForHuman: response.flaggedForHuman
  });

  // Add a small delay to seem more human
  await simulateTypingDelay(response.message.length);

  // Split long messages if needed
  const messageParts = splitMessage(response.message);

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
    { role: 'assistant', content: response.message }
  );
}

// ============================================================================
// Audio Message Processing
// ============================================================================

async function processAudioMessage(
  env: Env,
  ctx: ExecutionContext,
  message: {
    businessPhoneNumberId: string;
    from: string;
    fromName: string;
    messageId: string;
    type: string;
    raw: any; // AudioMessage after type guard
  }
): Promise<void> {
  // Extract audio metadata (type guard already verified this exists)
  const audioId = message.raw.audio.id;
  const audioSha256 = message.raw.audio.sha256;

  console.log(`Processing audio message from ${message.from} (ID: ${audioId})`);

  // Mark as read immediately
  await markAsRead(
    message.businessPhoneNumberId,
    env.WHATSAPP_ACCESS_TOKEN,
    message.messageId,
    false
  );

  // Small delay before showing typing
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Show typing indicator
  await markAsRead(
    message.businessPhoneNumberId,
    env.WHATSAPP_ACCESS_TOKEN,
    message.messageId,
    true
  );

  // Transcribe the audio
  const transcriptionResult = await transcribeAudioMessage(
    audioId,
    audioSha256,
    env.OPENAI_API_KEY,
    env.WHATSAPP_ACCESS_TOKEN,
    env.CONVERSATIONS
  );

  // Handle transcription errors
  if ('error' in transcriptionResult) {
    console.error('Transcription failed:', transcriptionResult);

    // Send user-friendly error message based on error type
    let errorMessage = "I had trouble understanding that voice message. Could you send it as text or try again?";

    if (transcriptionResult.type === 'download_failed') {
      errorMessage = "I couldn't access that voice message. Could you send it again or type your message?";
    } else if (transcriptionResult.type === 'invalid_audio') {
      errorMessage = "That audio file seems too large or invalid. Could you send a shorter message or type it out?";
    } else if (transcriptionResult.type === 'rate_limit') {
      errorMessage = "I'm experiencing high traffic right now. Could you try again in a moment or send a text message?";
    }

    await sendTextMessage(
      message.businessPhoneNumberId,
      env.WHATSAPP_ACCESS_TOKEN,
      message.from,
      errorMessage
    );
    return;
  }

  // Log successful transcription
  console.log(`Transcription successful: "${transcriptionResult.text}" (${transcriptionResult.language || 'unknown'}, confidence: ${transcriptionResult.confidence}, cached: ${transcriptionResult.cached})`);

  // Warn on low confidence
  if (transcriptionResult.confidence === 'low') {
    console.warn(`Low confidence transcription for audio ${audioId}`);
  }

  // Get business config
  const business = await db.getBusinessByPhoneId(env.DB, message.businessPhoneNumberId);
  if (!business) {
    console.error(`No business found for phone ID: ${message.businessPhoneNumberId}`);
    const demoBusiness = await db.getBusinessById(env.DB, 'demo-store-001');
    if (!demoBusiness) {
      console.error('Demo business not found. Please seed the database.');
      return;
    }
    // Continue with demo business
    await processTranscribedAudio(env, ctx, demoBusiness, message, transcriptionResult.text);
    return;
  }

  await processTranscribedAudio(env, ctx, business, message, transcriptionResult.text);
}

// Helper function to process transcribed audio as text
async function processTranscribedAudio(
  env: Env,
  ctx: ExecutionContext,
  business: db.Business,
  message: {
    businessPhoneNumberId: string;
    from: string;
    fromName: string;
  },
  transcribedText: string
): Promise<void> {
  // Create a text message object from the transcribed audio
  const textMessage = {
    businessPhoneNumberId: message.businessPhoneNumberId,
    from: message.from,
    fromName: message.fromName,
    text: transcribedText
  };

  // Process using existing text message flow
  await processMessage(env, ctx, business, textMessage);
}

// ============================================================================
// Conversation Summarization (Background Task)
// ============================================================================

async function summarizeConversation(
  env: Env,
  leadId: string,
  messages: Message[],
  existingSummary: db.ConversationSummary | null
): Promise<void> {
  try {
    console.log(`Summarizing conversation for lead ${leadId} (${messages.length} messages, existing summary: ${existingSummary ? 'yes' : 'no'})`);

    // Build the incremental prompt that merges existing summary with new messages
    const prompt = buildIncrementalSummaryPrompt(existingSummary, messages);

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
