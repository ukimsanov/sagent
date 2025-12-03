/**
 * Database utilities for D1 access from server components
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

// Re-export types from the main worker's queries (simplified versions)
export type ResponseAction =
  | 'show_products'
  | 'ask_clarification'
  | 'answer_question'
  | 'empathize'
  | 'greet'
  | 'thank'
  | 'handoff';

export interface MessageEvent {
  id: string;
  business_id: string;
  lead_id: string;
  timestamp: number;
  action: ResponseAction;
  intent_type: string | null;
  user_message: string | null;
  agent_response: string | null;
  search_query: string | null;
  products_shown: string | null;
  flagged_for_human: number;
  clarification_count: number;
  processing_time_ms: number | null;
}

export interface Lead {
  id: string;
  business_id: string;
  whatsapp_number: string;
  name: string | null;
  email: string | null;
  score: number;
  status: 'new' | 'engaged' | 'warm' | 'hot' | 'converted' | 'lost';
  first_contact: number;
  last_contact: number;
  message_count: number;
}

export interface ConversationSummary {
  id: string;
  lead_id: string;
  summary: string | null;
  key_interests: string | null;
  objections: string | null;
  next_steps: string | null;
  updated_at: number;
}

export interface Business {
  id: string;
  name: string;
  whatsapp_phone_id: string;
}

/**
 * Get the D1 database binding from Cloudflare context
 */
export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext();
  return env.DB as D1Database;
}

/**
 * Get analytics summary for a business
 */
export async function getAnalyticsSummary(
  db: D1Database,
  businessId: string,
  startTime: number,
  endTime: number
) {
  // Total messages
  const totalResult = await db
    .prepare(`
      SELECT COUNT(*) as count FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
    `)
    .bind(businessId, startTime, endTime)
    .first<{ count: number }>();

  // Action breakdown
  const actionResult = await db
    .prepare(`
      SELECT action, COUNT(*) as count FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
      GROUP BY action
    `)
    .bind(businessId, startTime, endTime)
    .all<{ action: ResponseAction; count: number }>();

  // Average processing time
  const avgTimeResult = await db
    .prepare(`
      SELECT AVG(processing_time_ms) as avg_time FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
        AND processing_time_ms IS NOT NULL
    `)
    .bind(businessId, startTime, endTime)
    .first<{ avg_time: number | null }>();

  // Handoff count
  const handoffResult = await db
    .prepare(`
      SELECT COUNT(*) as count FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
        AND (action = 'handoff' OR flagged_for_human = 1)
    `)
    .bind(businessId, startTime, endTime)
    .first<{ count: number }>();

  // Unique leads
  const leadsResult = await db
    .prepare(`
      SELECT COUNT(DISTINCT lead_id) as count FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
    `)
    .bind(businessId, startTime, endTime)
    .first<{ count: number }>();

  const totalMessages = totalResult?.count || 0;
  const actionBreakdown: Record<ResponseAction, number> = {
    show_products: 0,
    ask_clarification: 0,
    answer_question: 0,
    empathize: 0,
    greet: 0,
    thank: 0,
    handoff: 0
  };

  for (const row of actionResult.results || []) {
    actionBreakdown[row.action] = row.count;
  }

  return {
    totalMessages,
    actionBreakdown,
    avgProcessingTime: Math.round(avgTimeResult?.avg_time || 0),
    handoffRate: totalMessages > 0
      ? Math.round((handoffResult?.count || 0) / totalMessages * 100)
      : 0,
    uniqueLeads: leadsResult?.count || 0
  };
}

/**
 * Get message events for a business (paginated)
 */
export async function getMessageEvents(
  db: D1Database,
  businessId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
) {
  const { limit = 50, offset = 0 } = options;

  const countResult = await db
    .prepare('SELECT COUNT(*) as count FROM message_events WHERE business_id = ?')
    .bind(businessId)
    .first<{ count: number }>();

  const result = await db
    .prepare(`
      SELECT * FROM message_events
      WHERE business_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `)
    .bind(businessId, limit, offset)
    .all<MessageEvent>();

  return {
    events: result.results || [],
    total: countResult?.count || 0
  };
}

/**
 * Get leads for a business (paginated)
 */
export async function getLeads(
  db: D1Database,
  businessId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
) {
  const { limit = 50, offset = 0 } = options;

  const countResult = await db
    .prepare('SELECT COUNT(*) as count FROM leads WHERE business_id = ?')
    .bind(businessId)
    .first<{ count: number }>();

  const result = await db
    .prepare(`
      SELECT * FROM leads
      WHERE business_id = ?
      ORDER BY last_contact DESC
      LIMIT ? OFFSET ?
    `)
    .bind(businessId, limit, offset)
    .all<Lead>();

  return {
    leads: result.results || [],
    total: countResult?.count || 0
  };
}

/**
 * Get conversation events for a lead
 */
export async function getConversationEvents(
  db: D1Database,
  leadId: string
) {
  const result = await db
    .prepare(`
      SELECT * FROM message_events
      WHERE lead_id = ?
      ORDER BY timestamp ASC
    `)
    .bind(leadId)
    .all<MessageEvent>();

  return result.results || [];
}

/**
 * Get lead with summary
 */
export async function getLeadWithSummary(
  db: D1Database,
  leadId: string
) {
  const lead = await db
    .prepare('SELECT * FROM leads WHERE id = ?')
    .bind(leadId)
    .first<Lead>();

  if (!lead) return null;

  const summary = await db
    .prepare('SELECT * FROM conversation_summaries WHERE lead_id = ?')
    .bind(leadId)
    .first<ConversationSummary>();

  return { lead, summary };
}

/**
 * Get all businesses
 */
export async function getBusinesses(db: D1Database) {
  const result = await db
    .prepare('SELECT id, name, whatsapp_phone_id FROM businesses')
    .all<Business>();

  return result.results || [];
}
