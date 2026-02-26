/**
 * Smart Follow-up Engine
 *
 * Finds leads that have gone quiet, generates contextual follow-up
 * messages using LLM, and sends them via WhatsApp.
 *
 * Constraint: WhatsApp 24-hour service window — can only send free-form
 * messages within 24h of the customer's last message.
 */

import type { Business, Lead, ConversationSummary } from '../db/queries';
import { sendTextMessageReliable, type SendContext } from '../whatsapp/messages-reliable';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// ============================================================================
// Types
// ============================================================================

interface FollowUpCandidate {
  lead: Lead;
  summary: ConversationSummary | null;
}

interface FollowUpResult {
  leadId: string;
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================================================
// Candidate Selection
// ============================================================================

export async function getFollowUpCandidates(
  db: D1Database,
  businessId: string,
  delayHours: number,
): Promise<Lead[]> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgo = nowSeconds - 86400; // WhatsApp window
  const delayThreshold = nowSeconds - (delayHours * 3600); // Quiet long enough
  const oneDayAgoMs = Date.now() - 86400000; // For follow_ups dedup (created_at is ms)

  const result = await db.prepare(`
    SELECT l.* FROM leads l
    WHERE l.business_id = ?
      AND l.status IN ('warm', 'hot', 'engaged')
      AND l.score >= 30
      AND l.message_count >= 3
      AND l.last_contact >= ?
      AND l.last_contact <= ?
      AND l.id NOT IN (
        SELECT lead_id FROM follow_ups
        WHERE business_id = ? AND created_at >= ?
      )
    ORDER BY l.score DESC
    LIMIT 20
  `).bind(
    businessId,
    twentyFourHoursAgo,
    delayThreshold,
    businessId,
    Math.floor(oneDayAgoMs / 1000),
  ).all<Lead>();

  return result.results || [];
}

// ============================================================================
// Follow-up Message Generator
// ============================================================================

async function generateFollowUpMessage(
  business: Business,
  lead: Lead,
  summary: ConversationSummary | null,
  openaiApiKey: string,
  aiGatewayBaseURL?: string,
): Promise<string> {
  const customerName = lead.name || 'there';
  const interests = summary?.key_interests
    ? (() => { try { return JSON.parse(summary.key_interests).join(', '); } catch { return ''; } })()
    : '';
  const summaryText = summary?.summary || 'No conversation summary available';
  const brandTone = (business as any).brand_tone || 'friendly';

  const openai = createOpenAI({
    apiKey: openaiApiKey,
    ...(aiGatewayBaseURL ? { baseURL: aiGatewayBaseURL } : {}),
  });

  const { text } = await generateText({
    model: openai.responses('gpt-5-mini'),
    prompt: `You're a sales assistant at ${business.name}. Write a SHORT natural follow-up message (1-2 sentences, under 160 chars) for WhatsApp.

Customer: ${customerName}
Interests: ${interests || 'general browsing'}
Last conversation: ${summaryText}
Tone: ${brandTone}

Rules: Sound like a real person. Reference their interest. Don't be pushy. Don't use emojis. Don't start with "Hey" every time - vary your opener.`,
    maxOutputTokens: 100,
    temperature: 0.7,
  });

  return text.trim();
}

// ============================================================================
// Main Follow-up Processor
// ============================================================================

export async function processFollowUps(
  db: D1Database,
  business: Business & { follow_up_delay_hours?: number; whatsapp_phone_id: string },
  env: {
    openaiApiKey: string;
    whatsappAccessToken: string;
    aiGatewayBaseURL?: string;
  },
): Promise<FollowUpResult[]> {
  const delayHours = business.follow_up_delay_hours || 4;
  const candidates = await getFollowUpCandidates(db, business.id, delayHours);

  if (candidates.length === 0) {
    return [];
  }

  console.log(`[FollowUp] ${candidates.length} candidates for ${business.name}`);
  const results: FollowUpResult[] = [];

  for (const lead of candidates) {
    try {
      // Load conversation summary
      const summary = await db.prepare(
        `SELECT * FROM conversation_summaries WHERE lead_id = ?`,
      ).bind(lead.id).first<ConversationSummary>();

      // Generate follow-up message
      const message = await generateFollowUpMessage(
        business, lead, summary, env.openaiApiKey, env.aiGatewayBaseURL,
      );

      // Send via WhatsApp
      const sendCtx: SendContext = {
        db,
        phoneNumberId: business.whatsapp_phone_id,
        accessToken: env.whatsappAccessToken,
        to: lead.whatsapp_number,
        leadId: lead.id,
        businessId: business.id,
        incomingMessageId: 'follow-up',
      };

      const sendResult = await sendTextMessageReliable(sendCtx, message);

      if (!sendResult.success) {
        results.push({ leadId: lead.id, success: false, error: sendResult.error });
        continue;
      }

      // Log to follow_ups table
      const followUpId = `fu-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      await db.prepare(
        `INSERT INTO follow_ups (id, business_id, lead_id, message, status, sent_at) VALUES (?, ?, ?, ?, 'sent', unixepoch())`,
      ).bind(followUpId, business.id, lead.id, message).run();

      // Log as message_event for analytics
      const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      await db.prepare(
        `INSERT INTO message_events (id, business_id, lead_id, timestamp, action, intent_type, agent_response) VALUES (?, ?, ?, ?, 'greet', 'follow_up', ?)`,
      ).bind(eventId, business.id, lead.id, Date.now(), message).run();

      // Update last_contact
      await db.prepare(
        `UPDATE leads SET last_contact = unixepoch() WHERE id = ?`,
      ).bind(lead.id).run();

      results.push({ leadId: lead.id, success: true, message });
      console.log(`[FollowUp] Sent to ${lead.name || lead.whatsapp_number}: "${message}"`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[FollowUp] Failed for lead ${lead.id}:`, msg);
      results.push({ leadId: lead.id, success: false, error: msg });
    }
  }

  return results;
}
