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
// H3 FIX: Reliable message sending with retry + dead letter queue
import {
  sendTextMessageReliable,
  sendImageMessageReliable,
  type SendContext
} from './whatsapp/messages-reliable';
import { handleIncomingMessage as handleMessage } from './ai/handler';
import { buildIncrementalSummaryPrompt } from './ai/prompts';
import { transcribeAudioMessage } from './ai/transcription';
import { sendHandoffNotification } from './notifications/handoff';
import * as db from './db/queries';
// C4 FIX: Use Durable Objects for atomic conversation state (eliminates race conditions)
import {
  getConversation,
  addMessage,
  formatMessagesForLLM,
  wouldOverflow,
  type Message
} from './utils/conversation-do-client';
// Phase 5: Scale & Polish
import {
  isPhoneRateLimited,
  buildRateLimitResponse
} from './utils/rate-limiter';
import { updateLeadScoreInBackground } from './utils/lead-scoring';
// Phase 5: Dead Letter Queue monitoring
import {
  getDeadLetterStats,
  getUnresolvedEntries,
  resolveEntry,
  type OperationType
} from './db/dead-letter';
import { maskPhoneNumber, safeLog } from './utils/pii-masking';
import { logToDeadLetter } from './db/dead-letter';
// Phase 1: Semantic search embeddings
import { upsertProductVectorsBatch, hasProductVectors } from './ai/embeddings';

// ============================================================================
// Types
// ============================================================================

interface Env {
  // Bindings from wrangler.jsonc
  DB: D1Database;
  CONVERSATIONS: KVNamespace; // Used for dedup keys, rate limiting, transcription cache
  CONVERSATION_DO: DurableObjectNamespace; // C4 FIX: Atomic conversation state

  // Semantic search bindings (Phase 1: AI Sales Agent Redesign)
  PRODUCT_VECTORS: VectorizeIndex; // Vectorize for semantic product search
  AI: Ai; // Workers AI for embeddings (bge-base-en-v1.5)

  // Environment variables
  WHATSAPP_VERIFY_TOKEN: string;

  // Secrets (set via wrangler secret put)
  OPENAI_API_KEY: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_APP_SECRET?: string; // Optional - enables webhook signature validation

  // Phase 4: Handoff notifications
  RESEND_API_KEY?: string; // Optional - enables email notifications via Resend
  WORKER_URL?: string; // Optional - base URL for dashboard links in emails

  // Phase 5: Security
  CLEANUP_SECRET?: string; // Secret for cleanup endpoint (wrangler secret put CLEANUP_SECRET)
}

// ============================================================================
// Constants
// ============================================================================

const MAX_MESSAGE_LENGTH = 4096; // WhatsApp limit

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

    // =========================================================================
    // Admin: Dead Letter Queue monitoring endpoints
    // =========================================================================
    if (url.pathname.startsWith('/admin/dlq')) {
      return handleAdminDLQ(request, url, env);
    }

    // =========================================================================
    // Admin: Product embedding endpoints (Phase 1: Semantic Search)
    // =========================================================================
    if (url.pathname.startsWith('/admin/embed')) {
      return handleAdminEmbed(request, url, env);
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

    // C2 FIX: Use environment secret instead of hardcoded value
    // Set via: wrangler secret put CLEANUP_SECRET
    if (!env.CLEANUP_SECRET || secret !== env.CLEANUP_SECRET) {
      console.warn('Cleanup endpoint: unauthorized attempt');
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
    // H5 FIX: Log detailed error server-side, return generic message to client
    console.error('Cleanup error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
      // Details removed - security best practice
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// Admin: Dead Letter Queue Monitoring (GET/POST /admin/dlq/*)
// ============================================================================

async function handleAdminDLQ(request: Request, url: URL, env: Env): Promise<Response> {
  const jsonHeaders = { 'Content-Type': 'application/json' };

  // Auth check - reuse CLEANUP_SECRET for admin endpoints
  const authHeader = request.headers.get('Authorization');
  if (!env.CLEANUP_SECRET || authHeader !== `Bearer ${env.CLEANUP_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders
    });
  }

  try {
    // GET /admin/dlq/stats - Get DLQ statistics
    if (url.pathname === '/admin/dlq/stats' && request.method === 'GET') {
      const stats = await getDeadLetterStats(env.DB);
      return new Response(JSON.stringify({
        success: true,
        stats
      }), { headers: jsonHeaders });
    }

    // GET /admin/dlq/entries - List unresolved entries
    if (url.pathname === '/admin/dlq/entries' && request.method === 'GET') {
      const typeParam = url.searchParams.get('type') as OperationType | null;
      const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
      const entries = await getUnresolvedEntries(
        env.DB,
        typeParam || undefined,
        Math.min(limitParam, 100) // Cap at 100
      );
      return new Response(JSON.stringify({
        success: true,
        count: entries.length,
        entries
      }), { headers: jsonHeaders });
    }

    // POST /admin/dlq/resolve - Mark entry as resolved
    if (url.pathname === '/admin/dlq/resolve' && request.method === 'POST') {
      const body = await request.json() as { id?: string; resolved_by?: string };
      if (!body.id) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400,
          headers: jsonHeaders
        });
      }
      await resolveEntry(
        env.DB,
        body.id,
        (body.resolved_by as 'auto_retry' | 'manual' | 'expired') || 'manual'
      );
      return new Response(JSON.stringify({
        success: true,
        message: `Entry ${body.id} marked as resolved`
      }), { headers: jsonHeaders });
    }

    // Unknown DLQ endpoint
    return new Response(JSON.stringify({ error: 'Unknown DLQ endpoint' }), {
      status: 404,
      headers: jsonHeaders
    });

  } catch (error) {
    console.error('Admin DLQ error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: jsonHeaders
    });
  }
}

// ============================================================================
// Admin: Product Embedding (POST /admin/embed/*)
// Phase 1: Semantic Search Setup
// ============================================================================

async function handleAdminEmbed(request: Request, url: URL, env: Env): Promise<Response> {
  const jsonHeaders = { 'Content-Type': 'application/json' };

  // Auth check - reuse CLEANUP_SECRET for admin endpoints
  const authHeader = request.headers.get('Authorization');
  if (!env.CLEANUP_SECRET || authHeader !== `Bearer ${env.CLEANUP_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: jsonHeaders
    });
  }

  try {
    // POST /admin/embed/business - Embed all products for a business
    if (url.pathname === '/admin/embed/business' && request.method === 'POST') {
      const body = await request.json() as { business_id?: string };
      if (!body.business_id) {
        return new Response(JSON.stringify({ error: 'business_id required' }), {
          status: 400,
          headers: jsonHeaders
        });
      }

      // Get all products for the business
      const products = await db.getAllProductsForBusiness(env.DB, body.business_id);
      if (products.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          message: 'No products found for this business',
          embedded: 0
        }), { headers: jsonHeaders });
      }

      // Batch embed all products
      const result = await upsertProductVectorsBatch(env.PRODUCT_VECTORS, env.AI, products);

      if (!result.success) {
        return new Response(JSON.stringify({
          success: false,
          error: result.error
        }), { status: 500, headers: jsonHeaders });
      }

      return new Response(JSON.stringify({
        success: true,
        message: `Embedded ${result.upsertedCount} products for business ${body.business_id}`,
        embedded: result.upsertedCount
      }), { headers: jsonHeaders });
    }

    // GET /admin/embed/status - Check if a business has embeddings
    if (url.pathname === '/admin/embed/status' && request.method === 'GET') {
      const businessId = url.searchParams.get('business_id');
      if (!businessId) {
        return new Response(JSON.stringify({ error: 'business_id query param required' }), {
          status: 400,
          headers: jsonHeaders
        });
      }

      const hasVectors = await hasProductVectors(env.PRODUCT_VECTORS, env.AI, businessId);
      const productCount = (await db.getAllProductsForBusiness(env.DB, businessId)).length;

      return new Response(JSON.stringify({
        success: true,
        business_id: businessId,
        has_vectors: hasVectors,
        product_count: productCount
      }), { headers: jsonHeaders });
    }

    // POST /admin/embed/test-search - Test semantic search
    if (url.pathname === '/admin/embed/test-search' && request.method === 'POST') {
      const body = await request.json() as { business_id?: string; query?: string };
      if (!body.business_id || !body.query) {
        return new Response(JSON.stringify({ error: 'business_id and query required' }), {
          status: 400,
          headers: jsonHeaders
        });
      }

      // Import inline to avoid circular deps
      const { searchProductsVectorize } = await import('./ai/embeddings');
      const { getProductsByIds } = await import('./db/queries');

      const searchResult = await searchProductsVectorize(
        env.PRODUCT_VECTORS,
        env.AI,
        body.business_id,
        body.query,
        10
      );

      if (!searchResult.success) {
        return new Response(JSON.stringify({
          success: false,
          error: searchResult.error
        }), { status: 500, headers: jsonHeaders });
      }

      // Fetch full product data
      const productIds = (searchResult.results || []).map(r => r.id);
      const products = await getProductsByIds(env.DB, productIds);

      return new Response(JSON.stringify({
        success: true,
        query: body.query,
        results: (searchResult.results || []).map((r, i) => ({
          id: r.id,
          score: r.score,
          name: products[i]?.name || r.metadata?.name,
          category: products[i]?.category || r.metadata?.category,
          price: products[i]?.price || r.metadata?.price,
        }))
      }), { headers: jsonHeaders });
    }

    // POST /admin/embed/test-message - Test full message handling (bypasses WhatsApp)
    if (url.pathname === '/admin/embed/test-message' && request.method === 'POST') {
      const body = await request.json() as { business_id?: string; text?: string; from?: string };
      if (!body.business_id || !body.text) {
        return new Response(JSON.stringify({ error: 'business_id and text required' }), {
          status: 400,
          headers: jsonHeaders
        });
      }

      // Get business
      const business = await db.getBusinessById(env.DB, body.business_id);
      if (!business) {
        return new Response(JSON.stringify({ error: 'Business not found' }), {
          status: 404,
          headers: jsonHeaders
        });
      }

      // Get or create a test lead
      const testPhone = body.from || 'test-user-12345';
      const lead = await db.getOrCreateLead(env.DB, business.id, testPhone);

      // Get conversation history from Durable Object
      const conversation = await getConversation(
        env.CONVERSATION_DO,
        business.id,
        testPhone,
        lead.id
      );
      const conversationSummary = await db.getConversationSummary(env.DB, lead.id);

      // Call the handler directly
      const response = await handleMessage({
        db: env.DB,
        businessId: business.id,
        business,
        lead,
        messageText: body.text,
        openaiApiKey: env.OPENAI_API_KEY,
        conversationHistory: formatMessagesForLLM(conversation),
        conversationSummary,
        ai: env.AI,
        productVectors: env.PRODUCT_VECTORS,
      });

      return new Response(JSON.stringify({
        success: true,
        input: body.text,
        response: response.message,
        action: response.action,
        intentType: response.intentType,
        productsShown: response.productsShown,
        flaggedForHuman: response.flaggedForHuman,
      }), { headers: jsonHeaders });
    }

    // Unknown embed endpoint
    return new Response(JSON.stringify({ error: 'Unknown embed endpoint' }), {
      status: 404,
      headers: jsonHeaders
    });

  } catch (error) {
    console.error('Admin embed error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: jsonHeaders
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

    // C1 FIX: Idempotency key to prevent duplicate webhook processing
    // WhatsApp can send the same webhook multiple times
    const dedupKey = `dedup:${message.businessPhoneNumberId}:${message.from}:${message.messageId}`;
    const existingDedup = await env.CONVERSATIONS.get(dedupKey);
    if (existingDedup) {
      console.log(`⚡ Duplicate webhook detected, skipping: ${message.messageId}`);
      return; // Already processed this message
    }
    // Mark as processing (1-hour TTL to handle retries)
    await env.CONVERSATIONS.put(dedupKey, Date.now().toString(), { expirationTtl: 3600 });

    // Phase 5: Rate limiting check (before processing)
    const phoneRateLimit = await isPhoneRateLimited(env.CONVERSATIONS, message.from);
    if (!phoneRateLimit.allowed) {
      safeLog('warn', 'Rate limited phone number', {
        phone: maskPhoneNumber(message.from),
        remaining: phoneRateLimit.remaining,
        retryAfter: phoneRateLimit.retryAfter,
      });
      // Send rate limit message
      await sendTextMessage(
        message.businessPhoneNumberId,
        env.WHATSAPP_ACCESS_TOKEN,
        message.from,
        buildRateLimitResponse(phoneRateLimit)
      );
      return;
    }

    // Handle text OR audio messages
    if (message.text) {
      // H8 FIX: Input length validation (WhatsApp max is 4096)
      let messageText = message.text;
      if (messageText.length > MAX_MESSAGE_LENGTH) {
        console.warn(`Message too long (${messageText.length} chars), truncating to ${MAX_MESSAGE_LENGTH}`);
        messageText = messageText.substring(0, MAX_MESSAGE_LENGTH);
      }

      // Text message - process directly
      const textMessage = {
        businessPhoneNumberId: message.businessPhoneNumberId,
        from: message.from,
        fromName: message.fromName,
        text: messageText,
        messageId: message.messageId, // For DLQ traceability
      };

      safeLog('info', 'Processing text message', {
        phone: maskPhoneNumber(textMessage.from),
        messageLength: textMessage.text.length,
      });

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
    // Log to dead letter queue for retry/debugging
    // Note: We can't access 'message' here safely as it may not be defined if error occurred early
    await logToDeadLetter(
      env.DB,
      'webhook_process',
      'webhook-error',
      error instanceof Error ? error.message : 'Unknown error',
      { timestamp: Date.now() }
    );
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
    messageId: string; // WhatsApp message ID for DLQ traceability
  }
): Promise<void> {
  // Get or create lead
  const lead = await db.getOrCreateLead(env.DB, business.id, message.from);

  // Update lead name if we got it from WhatsApp
  if (message.fromName && message.fromName !== 'Unknown' && !lead.name) {
    await db.updateLeadName(env.DB, lead.id, message.fromName);
    lead.name = message.fromName;
  }

  // Get recent conversation history from Durable Object (C4 FIX: atomic access)
  const conversation = await getConversation(
    env.CONVERSATION_DO,
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
  // C4 FIX: Using Durable Object for atomic access
  await addMessage(
    env.CONVERSATION_DO,
    business.id,
    message.from,
    lead.id,
    { role: 'user', content: message.text }
  );

  // Track processing time for analytics
  const startTime = Date.now();

  // Process message with code-first handler
  // Phase 2: Pass Vectorize and AI bindings for semantic search
  const response = await handleMessage({
    db: env.DB,
    businessId: business.id,
    business,
    lead,
    messageText: message.text,
    openaiApiKey: env.OPENAI_API_KEY,
    conversationHistory: formatMessagesForLLM(conversation),
    conversationSummary,
    ai: env.AI,
    productVectors: env.PRODUCT_VECTORS,
  });

  const processingTime = Date.now() - startTime;

  safeLog('info', 'Agent response', {
    leadId: lead.id,
    action: response.action,
    flaggedForHuman: response.flaggedForHuman,
    processingTimeMs: processingTime,
  });

  // Phase 5: Update lead score in background
  // H2 FIX: Add error boundary to prevent silent failures
  ctx.waitUntil(
    updateLeadScoreInBackground(env.DB, lead.id, {
      intentType: response.intentType || null,
      action: response.action,
      messageCount: lead.message_count,
      productsShown: response.productsShown?.length || 0,
      clarificationCount: response.clarificationCount || 0,
      flaggedForHuman: response.flaggedForHuman,
      processingTimeMs: processingTime,
      previousScore: lead.score,
    }).catch(err => {
      console.error('Background lead score update failed:', err);
      logToDeadLetter(env.DB, 'lead_score', lead.id, err.message || 'Unknown error', {
        intentType: response.intentType,
        action: response.action,
        processingTimeMs: processingTime,
      });
    })
  );

  // Log event for analytics (Phase 3)
  try {
    await db.insertMessageEvent(env.DB, {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      business_id: business.id,
      lead_id: lead.id,
      timestamp: Date.now(),
      action: response.action,
      intent_type: response.intentType || null,
      user_message: message.text,
      agent_response: response.message,
      search_query: response.searchQuery || null,
      products_shown: response.productsShown || null,
      flagged_for_human: response.flaggedForHuman ? 1 : 0,
      clarification_count: response.clarificationCount || 0,
      processing_time_ms: processingTime
    });
  } catch (error) {
    // Don't fail the message handling if analytics logging fails
    console.error('Failed to log message event:', error);
  }

  // Phase 4: Send handoff notification if flagged
  // H2 FIX: Add error boundary to prevent silent failures
  if (response.flaggedForHuman) {
    // Use waitUntil to send notification in background (don't block response)
    ctx.waitUntil(
      sendHandoffNotification(
        {
          business,
          lead,
          reason: response.intentType || 'Unknown reason',
          urgency: response.action === 'empathize' ? 'high' : 'medium',
          recentMessages: formatMessagesForLLM(conversation).slice(-5) as Array<{ role: 'user' | 'assistant'; content: string }>,
          conversationSummary,
          dashboardUrl: env.WORKER_URL?.replace('/webhook', '') || undefined
        },
        env.RESEND_API_KEY
      ).then(result => {
        if (result.success) {
          console.log('📧 Handoff notification sent:', result.messageId);
        } else {
          console.log('📧 Handoff notification skipped:', result.error);
        }
      }).catch(err => {
        console.error('Background handoff notification failed:', err);
        logToDeadLetter(env.DB, 'handoff_notification', lead.id, err.message || 'Unknown error', {
          businessId: business.id,
          reason: response.intentType,
          urgency: response.action === 'empathize' ? 'high' : 'medium',
        });
      })
    );
  }

  // Add a small delay to seem more human
  await simulateTypingDelay(response.message.length);

  // H3 FIX: Build send context for reliable message sending
  const sendCtx: SendContext = {
    db: env.DB,
    phoneNumberId: message.businessPhoneNumberId,
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    to: message.from,
    leadId: lead.id,
    businessId: business.id,
    incomingMessageId: message.messageId, // DLQ: trace response back to incoming message
  };

  // Split long messages if needed
  const messageParts = splitMessage(response.message);

  // Send response(s) with retry logic (H3 FIX)
  for (const part of messageParts) {
    const result = await sendTextMessageReliable(sendCtx, part);
    if (!result.success) {
      console.error(`Message send failed after ${result.attempts} attempts: ${result.error}`);
      // Continue trying other parts even if one fails
    }

    // Small delay between multiple messages
    if (messageParts.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Send product images if requested by LLM decision (H3 FIX: with retry)
  if (response.imagesToSend && response.imagesToSend.length > 0) {
    console.log(`📸 Sending ${response.imagesToSend.length} product image(s)`);
    for (const image of response.imagesToSend) {
      const result = await sendImageMessageReliable(sendCtx, image.url, image.caption);
      if (!result.success) {
        console.error(`Image send failed after ${result.attempts} attempts: ${result.error}`);
        // Continue with other images even if one fails
      }
      // Small delay between images
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // Save assistant response to conversation (C4 FIX: using Durable Object)
  await addMessage(
    env.CONVERSATION_DO,
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
    messageId: string; // WhatsApp message ID for DLQ traceability
  },
  transcribedText: string
): Promise<void> {
  // Create a text message object from the transcribed audio
  const textMessage = {
    businessPhoneNumberId: message.businessPhoneNumberId,
    from: message.from,
    fromName: message.fromName,
    text: transcribedText,
    messageId: message.messageId, // For DLQ traceability
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

    // Store the summary with H7 FIX: pass message count for race condition prevention
    const wasUpdated = await db.upsertConversationSummary(
      env.DB,
      leadId,
      extracted.summary,
      extracted.key_interests || [],
      extracted.objections || [],
      extracted.next_steps,
      messages.length // H7 FIX: Track message count to prevent stale overwrites
    );

    if (wasUpdated) {
      console.log(`Conversation summary saved for lead ${leadId} (${messages.length} messages)`);
    } else {
      console.log(`H7: Summary update skipped for lead ${leadId} - a newer summary exists`);
    }
  } catch (error) {
    console.error('Failed to summarize conversation:', error);
  }
}

// ============================================================================
// Durable Objects Export (Required for wrangler binding)
// ============================================================================

export { ConversationDO } from './durable-objects/ConversationDO';
