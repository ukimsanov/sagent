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
  // Phase 4: B2B tenant config
  brand_tone: 'friendly' | 'professional' | 'casual' | null;
  greeting_template: string | null;
  escalation_keywords: string | null;
  after_hours_message: string | null;
  handoff_email: string | null;
  handoff_phone: string | null;
  auto_handoff_threshold: number | null;
  working_hours: string | null;
  timezone: string | null;
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
 * Get message events for a business (paginated with search/filter)
 */
export async function getMessageEvents(
  db: D1Database,
  businessId: string,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    action?: string;
    flagged?: boolean;
  } = {}
) {
  const { limit = 50, offset = 0, search, action, flagged } = options;

  // Build WHERE clauses dynamically
  const conditions: string[] = ['business_id = ?'];
  const params: (string | number)[] = [businessId];

  if (search) {
    conditions.push('(user_message LIKE ? OR agent_response LIKE ? OR lead_id LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }

  if (flagged !== undefined) {
    conditions.push('flagged_for_human = ?');
    params.push(flagged ? 1 : 0);
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM message_events WHERE ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>();

  const result = await db
    .prepare(`
      SELECT * FROM message_events
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `)
    .bind(...params, limit, offset)
    .all<MessageEvent>();

  return {
    events: result.results || [],
    total: countResult?.count || 0
  };
}

/**
 * Get leads for a business (paginated with search/filter)
 */
export async function getLeads(
  db: D1Database,
  businessId: string,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
  } = {}
) {
  const { limit = 50, offset = 0, search, status } = options;

  // Build WHERE clauses dynamically
  const conditions: string[] = ['business_id = ?'];
  const params: (string | number)[] = [businessId];

  if (search) {
    conditions.push('(name LIKE ? OR whatsapp_number LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern);
  }

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM leads WHERE ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>();

  const result = await db
    .prepare(`
      SELECT * FROM leads
      WHERE ${whereClause}
      ORDER BY last_contact DESC
      LIMIT ? OFFSET ?
    `)
    .bind(...params, limit, offset)
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

/**
 * Get a business by ID with full config
 */
export async function getBusinessById(db: D1Database, businessId: string) {
  const result = await db
    .prepare('SELECT * FROM businesses WHERE id = ?')
    .bind(businessId)
    .first<Business>();

  return result;
}

/**
 * Get intent type breakdown for analytics
 */
export async function getIntentBreakdown(
  db: D1Database,
  businessId: string,
  startTime: number,
  endTime: number
) {
  const result = await db
    .prepare(`
      SELECT intent_type, COUNT(*) as count
      FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
        AND intent_type IS NOT NULL
      GROUP BY intent_type
      ORDER BY count DESC
      LIMIT 10
    `)
    .bind(businessId, startTime, endTime)
    .all<{ intent_type: string; count: number }>();

  return result.results || [];
}

/**
 * Get lead funnel metrics
 */
export async function getLeadFunnelMetrics(
  db: D1Database,
  businessId: string
) {
  const result = await db
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM leads
      WHERE business_id = ?
      GROUP BY status
    `)
    .bind(businessId)
    .all<{ status: string; count: number }>();

  const funnel: Record<string, number> = {
    new: 0,
    engaged: 0,
    warm: 0,
    hot: 0,
    converted: 0,
    lost: 0,
  };

  for (const row of result.results || []) {
    funnel[row.status] = row.count;
  }

  return funnel;
}

/**
 * Get top search queries/product interests
 */
export async function getTopSearchQueries(
  db: D1Database,
  businessId: string,
  startTime: number,
  endTime: number
) {
  const result = await db
    .prepare(`
      SELECT search_query, COUNT(*) as count
      FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
        AND search_query IS NOT NULL AND search_query != ''
      GROUP BY search_query
      ORDER BY count DESC
      LIMIT 10
    `)
    .bind(businessId, startTime, endTime)
    .all<{ search_query: string; count: number }>();

  return result.results || [];
}

/**
 * Get escalation/handoff reasons
 */
export async function getHandoffReasons(
  db: D1Database,
  businessId: string,
  startTime: number,
  endTime: number
) {
  const result = await db
    .prepare(`
      SELECT intent_type, COUNT(*) as count
      FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
        AND (action = 'handoff' OR action = 'empathize' OR flagged_for_human = 1)
        AND intent_type IS NOT NULL
      GROUP BY intent_type
      ORDER BY count DESC
      LIMIT 5
    `)
    .bind(businessId, startTime, endTime)
    .all<{ intent_type: string; count: number }>();

  return result.results || [];
}

/**
 * Update business config
 */
export async function updateBusinessConfig(
  db: D1Database,
  businessId: string,
  config: {
    brand_tone?: string;
    greeting_template?: string | null;
    escalation_keywords?: string | null;
    after_hours_message?: string | null;
    handoff_email?: string | null;
    handoff_phone?: string | null;
    auto_handoff_threshold?: number;
    working_hours?: string | null;
    timezone?: string | null;
  }
) {
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (config.brand_tone !== undefined) {
    updates.push('brand_tone = ?');
    values.push(config.brand_tone);
  }
  if (config.greeting_template !== undefined) {
    updates.push('greeting_template = ?');
    values.push(config.greeting_template);
  }
  if (config.escalation_keywords !== undefined) {
    updates.push('escalation_keywords = ?');
    values.push(config.escalation_keywords);
  }
  if (config.after_hours_message !== undefined) {
    updates.push('after_hours_message = ?');
    values.push(config.after_hours_message);
  }
  if (config.handoff_email !== undefined) {
    updates.push('handoff_email = ?');
    values.push(config.handoff_email);
  }
  if (config.handoff_phone !== undefined) {
    updates.push('handoff_phone = ?');
    values.push(config.handoff_phone);
  }
  if (config.auto_handoff_threshold !== undefined) {
    updates.push('auto_handoff_threshold = ?');
    values.push(config.auto_handoff_threshold);
  }
  if (config.working_hours !== undefined) {
    updates.push('working_hours = ?');
    values.push(config.working_hours);
  }
  if (config.timezone !== undefined) {
    updates.push('timezone = ?');
    values.push(config.timezone);
  }

  if (updates.length === 0) return;

  values.push(businessId);

  await db
    .prepare(`UPDATE businesses SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}
