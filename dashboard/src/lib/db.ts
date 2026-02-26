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
  sentiment: string | null;
}

export interface Lead {
  id: string;
  business_id: string;
  whatsapp_number: string;
  name: string | null;
  email: string | null;
  score: number;
  status: 'new' | 'engaged' | 'warm' | 'hot' | 'converted' | 'lost';
  tags: string | null;
  first_contact: number;
  last_contact: number;
  message_count: number;
  notes: string | null;
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
  // Phase 6: AI enable/disable toggle
  ai_enabled: number; // 0 = disabled, 1 = enabled (default)
  // Phase 6: Automation settings
  digest_email: string | null;
  digest_daily_enabled: number;
  digest_weekly_enabled: number;
  follow_up_enabled: number;
  follow_up_delay_hours: number;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  category: string | null;
  in_stock: number;
  stock_quantity: number | null;
  metadata: string | null;
  image_url: string | null;
  created_at: number;
  updated_at: number;
}

export interface ProductWithImages extends Omit<Product, 'image_url'> {
  image_url: string | null;
  image_urls: string[];
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
    ai_enabled?: number;
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

  if (config.ai_enabled !== undefined) {
    updates.push('ai_enabled = ?');
    values.push(config.ai_enabled);
  }
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
  // Phase 6: Automation settings
  if ((config as any).digest_email !== undefined) {
    updates.push('digest_email = ?');
    values.push((config as any).digest_email);
  }
  if ((config as any).digest_daily_enabled !== undefined) {
    updates.push('digest_daily_enabled = ?');
    values.push((config as any).digest_daily_enabled);
  }
  if ((config as any).digest_weekly_enabled !== undefined) {
    updates.push('digest_weekly_enabled = ?');
    values.push((config as any).digest_weekly_enabled);
  }
  if ((config as any).follow_up_enabled !== undefined) {
    updates.push('follow_up_enabled = ?');
    values.push((config as any).follow_up_enabled);
  }
  if ((config as any).follow_up_delay_hours !== undefined) {
    updates.push('follow_up_delay_hours = ?');
    values.push((config as any).follow_up_delay_hours);
  }

  if (updates.length === 0) return;

  values.push(businessId);

  await db
    .prepare(`UPDATE businesses SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

// ============================================================================
// Product Queries
// ============================================================================

/**
 * Parse image URLs from JSON string
 */
function parseImageUrls(imageUrl: string | null): string[] {
  if (!imageUrl) return [];
  try {
    const parsed = JSON.parse(imageUrl);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Convert Product to ProductWithImages
 */
function toProductWithImages(product: Product): ProductWithImages {
  return {
    ...product,
    image_urls: parseImageUrls(product.image_url),
  };
}

/**
 * Get products for a business (paginated with search/filter)
 */
export async function getProducts(
  db: D1Database,
  businessId: string,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    category?: string;
    inStock?: boolean;
  } = {}
) {
  const { limit = 50, offset = 0, search, category, inStock } = options;

  const conditions: string[] = ['business_id = ?'];
  const params: (string | number)[] = [businessId];

  if (search) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern);
  }

  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  if (inStock !== undefined) {
    conditions.push('in_stock = ?');
    params.push(inStock ? 1 : 0);
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM products WHERE ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>();

  const result = await db
    .prepare(`
      SELECT * FROM products
      WHERE ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `)
    .bind(...params, limit, offset)
    .all<Product>();

  return {
    products: (result.results || []).map(toProductWithImages),
    total: countResult?.count || 0,
  };
}

/**
 * Get a single product by ID
 */
export async function getProductById(
  db: D1Database,
  productId: string
): Promise<ProductWithImages | null> {
  const result = await db
    .prepare('SELECT * FROM products WHERE id = ?')
    .bind(productId)
    .first<Product>();

  return result ? toProductWithImages(result) : null;
}

/**
 * Get distinct categories for a business
 */
export async function getCategories(
  db: D1Database,
  businessId: string
): Promise<string[]> {
  const result = await db
    .prepare('SELECT DISTINCT category FROM products WHERE business_id = ? AND category IS NOT NULL ORDER BY category')
    .bind(businessId)
    .all<{ category: string }>();

  return (result.results || []).map(r => r.category);
}

/**
 * Create a new product
 */
export async function createProduct(
  db: D1Database,
  product: {
    business_id: string;
    name: string;
    description?: string | null;
    price?: number | null;
    currency?: string;
    category?: string | null;
    in_stock?: number;
    stock_quantity?: number | null;
    metadata?: string | null;
    image_urls?: string[];
  }
): Promise<ProductWithImages> {
  const id = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const now = Math.floor(Date.now() / 1000);

  const imageUrl = product.image_urls && product.image_urls.length > 0
    ? JSON.stringify(product.image_urls)
    : null;

  await db
    .prepare(`
      INSERT INTO products (
        id, business_id, name, description, price, currency,
        category, in_stock, stock_quantity, metadata, image_url,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id,
      product.business_id,
      product.name,
      product.description ?? null,
      product.price ?? null,
      product.currency ?? 'USD',
      product.category ?? null,
      product.in_stock ?? 1,
      product.stock_quantity ?? null,
      product.metadata ?? null,
      imageUrl,
      now,
      now
    )
    .run();

  return {
    id,
    business_id: product.business_id,
    name: product.name,
    description: product.description ?? null,
    price: product.price ?? null,
    currency: product.currency ?? 'USD',
    category: product.category ?? null,
    in_stock: product.in_stock ?? 1,
    stock_quantity: product.stock_quantity ?? null,
    metadata: product.metadata ?? null,
    image_url: imageUrl,
    image_urls: product.image_urls ?? [],
    created_at: now,
    updated_at: now,
  };
}

/**
 * Update a product
 */
export async function updateProduct(
  db: D1Database,
  productId: string,
  updates: {
    name?: string;
    description?: string | null;
    price?: number | null;
    currency?: string;
    category?: string | null;
    in_stock?: number;
    stock_quantity?: number | null;
    metadata?: string | null;
    image_urls?: string[];
  }
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.price !== undefined) {
    fields.push('price = ?');
    values.push(updates.price);
  }
  if (updates.currency !== undefined) {
    fields.push('currency = ?');
    values.push(updates.currency);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    values.push(updates.category);
  }
  if (updates.in_stock !== undefined) {
    fields.push('in_stock = ?');
    values.push(updates.in_stock);
  }
  if (updates.stock_quantity !== undefined) {
    fields.push('stock_quantity = ?');
    values.push(updates.stock_quantity);
  }
  if (updates.metadata !== undefined) {
    fields.push('metadata = ?');
    values.push(updates.metadata);
  }
  if (updates.image_urls !== undefined) {
    fields.push('image_url = ?');
    values.push(updates.image_urls.length > 0 ? JSON.stringify(updates.image_urls) : null);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(Math.floor(Date.now() / 1000));
  values.push(productId);

  await db
    .prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

/**
 * Delete a product
 */
export async function deleteProduct(
  db: D1Database,
  productId: string
): Promise<void> {
  await db
    .prepare('DELETE FROM products WHERE id = ?')
    .bind(productId)
    .run();
}

/**
 * Toggle product stock status
 */
export async function toggleProductStock(
  db: D1Database,
  productId: string,
  inStock: boolean
): Promise<void> {
  await db
    .prepare('UPDATE products SET in_stock = ?, updated_at = ? WHERE id = ?')
    .bind(inStock ? 1 : 0, Math.floor(Date.now() / 1000), productId)
    .run();
}

// ============================================================================
// Time-Series Analytics Queries
// ============================================================================

export interface TimeSeriesPoint {
  date: string;
  messages: number;
  unique_leads: number;
  handoffs: number;
  avg_response_time: number;
}

/**
 * Get daily time-series analytics data for charts
 */
export async function getTimeSeriesData(
  db: D1Database,
  businessId: string,
  startTime: number,
  endTime: number
): Promise<TimeSeriesPoint[]> {
  const result = await db
    .prepare(`
      SELECT
        DATE(timestamp / 1000, 'unixepoch') as date,
        COUNT(*) as messages,
        COUNT(DISTINCT lead_id) as unique_leads,
        SUM(CASE WHEN action = 'handoff' OR flagged_for_human = 1 THEN 1 ELSE 0 END) as handoffs,
        COALESCE(AVG(CASE WHEN processing_time_ms IS NOT NULL THEN processing_time_ms END), 0) as avg_response_time
      FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
      GROUP BY date
      ORDER BY date ASC
    `)
    .bind(businessId, startTime, endTime)
    .all<TimeSeriesPoint>();

  return result.results || [];
}

export interface PeakHourPoint {
  hour: number;
  day_of_week: number;
  count: number;
}

/**
 * Get peak hours heatmap data (hour x day of week)
 */
export async function getPeakHoursData(
  db: D1Database,
  businessId: string,
  startTime: number,
  endTime: number
): Promise<PeakHourPoint[]> {
  const result = await db
    .prepare(`
      SELECT
        CAST(strftime('%H', timestamp / 1000, 'unixepoch') AS INTEGER) as hour,
        CAST(strftime('%w', timestamp / 1000, 'unixepoch') AS INTEGER) as day_of_week,
        COUNT(*) as count
      FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
      GROUP BY hour, day_of_week
    `)
    .bind(businessId, startTime, endTime)
    .all<PeakHourPoint>();

  return result.results || [];
}

// ============================================================================
// Escalation / Human Flag Types & Queries
// ============================================================================

export interface HumanFlag {
  id: string;
  lead_id: string;
  urgency: 'low' | 'medium' | 'high';
  reason: string;
  resolved: number;
  created_at: number;
  resolved_at: number | null;
}

export interface EscalationRow extends HumanFlag {
  lead_name: string | null;
  whatsapp_number: string;
  lead_score: number;
}

/**
 * Get escalations for a business (joined through leads table)
 */
export async function getEscalations(
  db: D1Database,
  businessId: string,
  options: {
    status?: 'open' | 'resolved' | 'all';
    urgency?: 'low' | 'medium' | 'high';
  } = {}
): Promise<EscalationRow[]> {
  const { status = 'all', urgency } = options;

  const conditions: string[] = ['l.business_id = ?'];
  const params: (string | number)[] = [businessId];

  if (status === 'open') {
    conditions.push('hf.resolved = 0');
  } else if (status === 'resolved') {
    conditions.push('hf.resolved = 1');
  }

  if (urgency) {
    conditions.push('hf.urgency = ?');
    params.push(urgency);
  }

  const whereClause = conditions.join(' AND ');

  const result = await db
    .prepare(`
      SELECT hf.*, l.name as lead_name, l.whatsapp_number, l.score as lead_score
      FROM human_flags hf
      LEFT JOIN leads l ON hf.lead_id = l.id
      WHERE ${whereClause}
      ORDER BY
        CASE hf.urgency WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        hf.created_at DESC
    `)
    .bind(...params)
    .all<EscalationRow>();

  return result.results || [];
}

/**
 * Get escalation KPI stats
 */
export async function getEscalationStats(
  db: D1Database,
  businessId: string
) {
  const result = await db
    .prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN hf.resolved = 0 THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN hf.urgency = 'high' AND hf.resolved = 0 THEN 1 ELSE 0 END) as high_urgency,
        SUM(CASE WHEN hf.resolved = 1 AND DATE(hf.resolved_at, 'unixepoch') = DATE('now') THEN 1 ELSE 0 END) as resolved_today
      FROM human_flags hf
      LEFT JOIN leads l ON hf.lead_id = l.id
      WHERE l.business_id = ?
    `)
    .bind(businessId)
    .first<{ total: number; open_count: number; high_urgency: number; resolved_today: number }>();

  return {
    total: result?.total || 0,
    openCount: result?.open_count || 0,
    highUrgency: result?.high_urgency || 0,
    resolvedToday: result?.resolved_today || 0,
  };
}

/**
 * Resolve an escalation
 */
export async function resolveEscalation(
  db: D1Database,
  escalationId: string
): Promise<void> {
  await db
    .prepare('UPDATE human_flags SET resolved = 1, resolved_at = unixepoch() WHERE id = ?')
    .bind(escalationId)
    .run();
}

/**
 * Get escalation by ID (for ownership verification)
 */
export async function getEscalationById(
  db: D1Database,
  escalationId: string
): Promise<EscalationRow | null> {
  const result = await db
    .prepare(`
      SELECT hf.*, l.name as lead_name, l.whatsapp_number, l.score as lead_score
      FROM human_flags hf
      LEFT JOIN leads l ON hf.lead_id = l.id
      WHERE hf.id = ?
    `)
    .bind(escalationId)
    .first<EscalationRow>();

  return result || null;
}

// ============================================================================
// Appointment & Callback Queries
// ============================================================================

export interface Appointment {
  id: string;
  lead_id: string;
  business_id: string;
  requested_date: string | null;
  requested_time: string | null;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: number;
}

export interface AppointmentRow extends Appointment {
  lead_name: string | null;
  whatsapp_number: string;
}

export interface CallbackRequest {
  id: string;
  lead_id: string;
  business_id: string;
  preferred_time: string | null;
  reason: string | null;
  status: 'pending' | 'completed';
  created_at: number;
}

export interface CallbackRow extends CallbackRequest {
  lead_name: string | null;
  whatsapp_number: string;
}

/**
 * Get appointments for a business
 */
export async function getAppointments(
  db: D1Database,
  businessId: string,
  options: { status?: string } = {}
): Promise<AppointmentRow[]> {
  const conditions: string[] = ['a.business_id = ?'];
  const params: (string | number)[] = [businessId];

  if (options.status) {
    conditions.push('a.status = ?');
    params.push(options.status);
  }

  const result = await db
    .prepare(`
      SELECT a.*, l.name as lead_name, l.whatsapp_number
      FROM appointments a
      LEFT JOIN leads l ON a.lead_id = l.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.created_at DESC
    `)
    .bind(...params)
    .all<AppointmentRow>();

  return result.results || [];
}

/**
 * Get callback requests for a business
 */
export async function getCallbackRequests(
  db: D1Database,
  businessId: string,
  options: { status?: string } = {}
): Promise<CallbackRow[]> {
  const conditions: string[] = ['cr.business_id = ?'];
  const params: (string | number)[] = [businessId];

  if (options.status) {
    conditions.push('cr.status = ?');
    params.push(options.status);
  }

  const result = await db
    .prepare(`
      SELECT cr.*, l.name as lead_name, l.whatsapp_number
      FROM callback_requests cr
      LEFT JOIN leads l ON cr.lead_id = l.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY cr.created_at DESC
    `)
    .bind(...params)
    .all<CallbackRow>();

  return result.results || [];
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatus(
  db: D1Database,
  appointmentId: string,
  status: 'confirmed' | 'cancelled'
): Promise<void> {
  await db
    .prepare('UPDATE appointments SET status = ? WHERE id = ?')
    .bind(status, appointmentId)
    .run();
}

/**
 * Update callback request status
 */
export async function updateCallbackStatus(
  db: D1Database,
  callbackId: string,
  status: 'completed'
): Promise<void> {
  await db
    .prepare('UPDATE callback_requests SET status = ? WHERE id = ?')
    .bind(status, callbackId)
    .run();
}

// ============================================================================
// Promo Code Queries
// ============================================================================

export interface PromoCode {
  id: string;
  business_id: string;
  code: string;
  discount_percent: number | null;
  discount_amount: number | null;
  used_by_lead_id: string | null;
  expires_at: number | null;
  created_at: number;
}

export interface PromoCodeRow extends PromoCode {
  used_by_name: string | null;
}

/**
 * Get promo codes for a business
 */
export async function getPromoCodes(
  db: D1Database,
  businessId: string
): Promise<PromoCodeRow[]> {
  const result = await db
    .prepare(`
      SELECT pc.*, l.name as used_by_name
      FROM promo_codes pc
      LEFT JOIN leads l ON pc.used_by_lead_id = l.id
      WHERE pc.business_id = ?
      ORDER BY pc.created_at DESC
    `)
    .bind(businessId)
    .all<PromoCodeRow>();

  return result.results || [];
}

/**
 * Get promo code stats
 */
export async function getPromoStats(
  db: D1Database,
  businessId: string
) {
  const result = await db
    .prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN used_by_lead_id IS NOT NULL THEN 1 ELSE 0 END) as used_count,
        SUM(CASE WHEN used_by_lead_id IS NULL AND (expires_at IS NULL OR expires_at > unixepoch()) THEN 1 ELSE 0 END) as active_count
      FROM promo_codes
      WHERE business_id = ?
    `)
    .bind(businessId)
    .first<{ total: number; used_count: number; active_count: number }>();

  return {
    total: result?.total || 0,
    usedCount: result?.used_count || 0,
    activeCount: result?.active_count || 0,
  };
}

/**
 * Create a new promo code
 */
export async function createPromoCode(
  db: D1Database,
  promo: {
    business_id: string;
    code: string;
    discount_percent?: number | null;
    discount_amount?: number | null;
    expires_at?: number | null;
  }
): Promise<void> {
  const id = `promo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db
    .prepare(`
      INSERT INTO promo_codes (id, business_id, code, discount_percent, discount_amount, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id,
      promo.business_id,
      promo.code,
      promo.discount_percent ?? null,
      promo.discount_amount ?? null,
      promo.expires_at ?? null
    )
    .run();
}

/**
 * Deactivate a promo code (set expires_at to now)
 */
export async function deactivatePromoCode(
  db: D1Database,
  promoId: string
): Promise<void> {
  await db
    .prepare('UPDATE promo_codes SET expires_at = unixepoch() WHERE id = ?')
    .bind(promoId)
    .run();
}

// ============================================================================
// Conversations Grouped by Lead
// ============================================================================

export interface ConversationThread {
  lead_id: string;
  lead_name: string | null;
  whatsapp_number: string;
  lead_score: number;
  lead_status: string;
  message_count: number;
  last_activity: number;
  last_message: string | null;
  flag_count: number;
}

/**
 * Get conversations grouped by lead
 */
export async function getConversationThreads(
  db: D1Database,
  businessId: string,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    hasEscalation?: boolean;
  } = {}
): Promise<{ threads: ConversationThread[]; total: number }> {
  const { limit = 50, offset = 0, search, hasEscalation } = options;

  const conditions: string[] = ['l.business_id = ?'];
  const params: (string | number)[] = [businessId];

  if (search) {
    conditions.push('(l.name LIKE ? OR l.whatsapp_number LIKE ?)');
    const pattern = `%${search}%`;
    params.push(pattern, pattern);
  }

  const whereClause = conditions.join(' AND ');

  const havingClause = hasEscalation ? 'HAVING flag_count > 0' : '';

  const countResult = await db
    .prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT l.id, SUM(CASE WHEN me.flagged_for_human = 1 THEN 1 ELSE 0 END) as flag_count
        FROM leads l
        LEFT JOIN message_events me ON me.lead_id = l.id AND me.business_id = l.business_id
        WHERE ${whereClause}
        GROUP BY l.id
        ${havingClause}
      )
    `)
    .bind(...params)
    .first<{ count: number }>();

  const result = await db
    .prepare(`
      SELECT
        l.id as lead_id, l.name as lead_name, l.whatsapp_number,
        l.score as lead_score, l.status as lead_status,
        COUNT(me.id) as message_count,
        MAX(me.timestamp) as last_activity,
        (SELECT me2.user_message FROM message_events me2 WHERE me2.lead_id = l.id ORDER BY me2.timestamp DESC LIMIT 1) as last_message,
        SUM(CASE WHEN me.flagged_for_human = 1 THEN 1 ELSE 0 END) as flag_count
      FROM leads l
      LEFT JOIN message_events me ON me.lead_id = l.id AND me.business_id = l.business_id
      WHERE ${whereClause}
      GROUP BY l.id
      ${havingClause}
      ORDER BY last_activity DESC
      LIMIT ? OFFSET ?
    `)
    .bind(...params, limit, offset)
    .all<ConversationThread>();

  return {
    threads: result.results || [],
    total: countResult?.count || 0,
  };
}

export interface AnalyticsSummaryWithComparison {
  current: {
    totalMessages: number;
    uniqueLeads: number;
    avgProcessingTime: number;
    handoffRate: number;
    resolutionRate: number;
    actionBreakdown: Record<ResponseAction, number>;
  };
  previous: {
    totalMessages: number;
    uniqueLeads: number;
    avgProcessingTime: number;
    handoffRate: number;
    resolutionRate: number;
  };
  changes: {
    totalMessages: number;
    uniqueLeads: number;
    avgProcessingTime: number;
    handoffRate: number;
    resolutionRate: number;
  };
}

/**
 * Get analytics with comparison to previous equivalent period
 */
export async function getAnalyticsSummaryWithComparison(
  db: D1Database,
  businessId: string,
  startTime: number,
  endTime: number
): Promise<AnalyticsSummaryWithComparison> {
  const periodLength = endTime - startTime;
  const prevStart = startTime - periodLength;
  const prevEnd = startTime;

  const [current, previous] = await Promise.all([
    getAnalyticsSummary(db, businessId, startTime, endTime),
    getAnalyticsSummary(db, businessId, prevStart, prevEnd),
  ]);

  const currentResolutionRate = current.totalMessages > 0
    ? 100 - current.handoffRate
    : 0;
  const previousResolutionRate = previous.totalMessages > 0
    ? 100 - previous.handoffRate
    : 0;

  function pctChange(curr: number, prev: number): number {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  return {
    current: {
      ...current,
      resolutionRate: currentResolutionRate,
    },
    previous: {
      ...previous,
      resolutionRate: previousResolutionRate,
    },
    changes: {
      totalMessages: pctChange(current.totalMessages, previous.totalMessages),
      uniqueLeads: pctChange(current.uniqueLeads, previous.uniqueLeads),
      avgProcessingTime: pctChange(current.avgProcessingTime, previous.avgProcessingTime),
      handoffRate: pctChange(current.handoffRate, previous.handoffRate),
      resolutionRate: pctChange(currentResolutionRate, previousResolutionRate),
    },
  };
}

// ============================================================================
// Sentiment Queries
// ============================================================================

/**
 * Get sentiment breakdown for a business in a time range
 */
export async function getSentimentBreakdown(
  db: D1Database,
  businessId: string,
  startTime: number,
  endTime: number
) {
  const result = await db
    .prepare(`
      SELECT sentiment, COUNT(*) as count
      FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
        AND sentiment IS NOT NULL
      GROUP BY sentiment
      ORDER BY count DESC
    `)
    .bind(businessId, startTime, endTime)
    .all<{ sentiment: string; count: number }>();

  return result.results || [];
}

// ============================================================================
// Insights Data Queries
// ============================================================================

/**
 * Get data needed for rule-based insights generation
 */
export async function getInsightsData(
  db: D1Database,
  businessId: string,
  startTime: number,
  endTime: number
) {
  const periodLength = endTime - startTime;
  const prevStart = startTime - periodLength;

  const [
    zeroResultSearches,
    handoffReasons,
    peakHour,
    hotLeadsNoFollowUp,
    currentHandoffRate,
    previousHandoffRate,
  ] = await Promise.all([
    db.prepare(`
      SELECT search_query, COUNT(*) as count
      FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
        AND search_query IS NOT NULL AND search_query != ''
        AND (products_shown IS NULL OR products_shown = '[]' OR products_shown = 'null')
      GROUP BY search_query ORDER BY count DESC LIMIT 5
    `).bind(businessId, startTime, endTime)
      .all<{ search_query: string; count: number }>(),

    db.prepare(`
      SELECT intent_type, COUNT(*) as count
      FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
        AND (action = 'handoff' OR flagged_for_human = 1)
        AND intent_type IS NOT NULL
      GROUP BY intent_type ORDER BY count DESC LIMIT 3
    `).bind(businessId, startTime, endTime)
      .all<{ intent_type: string; count: number }>(),

    db.prepare(`
      SELECT CAST(strftime('%H', timestamp / 1000, 'unixepoch') AS INTEGER) as hour,
             COUNT(*) as count
      FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
      GROUP BY hour ORDER BY count DESC LIMIT 1
    `).bind(businessId, startTime, endTime)
      .first<{ hour: number; count: number }>(),

    db.prepare(`
      SELECT id, name, whatsapp_number, score, last_contact
      FROM leads
      WHERE business_id = ? AND status = 'hot'
        AND last_contact < ?
      ORDER BY score DESC LIMIT 5
    `).bind(businessId, Math.floor(Date.now() / 1000) - 3 * 86400)
      .all<{ id: string; name: string | null; whatsapp_number: string; score: number; last_contact: number }>(),

    db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN action = 'handoff' OR flagged_for_human = 1 THEN 1 ELSE 0 END) as handoffs
      FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
    `).bind(businessId, startTime, endTime)
      .first<{ total: number; handoffs: number }>(),

    db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN action = 'handoff' OR flagged_for_human = 1 THEN 1 ELSE 0 END) as handoffs
      FROM message_events
      WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?
    `).bind(businessId, prevStart, startTime)
      .first<{ total: number; handoffs: number }>(),
  ]);

  return {
    zeroResultSearches: zeroResultSearches.results || [],
    handoffReasons: handoffReasons.results || [],
    peakHour,
    hotLeadsNoFollowUp: hotLeadsNoFollowUp.results || [],
    currentHandoffRate,
    previousHandoffRate,
  };
}

// ============================================================================
// Lead-Specific Queries (for profile page)
// ============================================================================

/**
 * Get escalations for a specific lead
 */
export async function getLeadEscalations(
  db: D1Database,
  leadId: string
): Promise<HumanFlag[]> {
  const result = await db
    .prepare('SELECT * FROM human_flags WHERE lead_id = ? ORDER BY created_at DESC')
    .bind(leadId)
    .all<HumanFlag>();

  return result.results || [];
}

/**
 * Get appointments for a specific lead
 */
export async function getLeadAppointments(
  db: D1Database,
  leadId: string
): Promise<Appointment[]> {
  const result = await db
    .prepare('SELECT * FROM appointments WHERE lead_id = ? ORDER BY created_at DESC')
    .bind(leadId)
    .all<Appointment>();

  return result.results || [];
}

/**
 * Get callback requests for a specific lead
 */
export async function getLeadCallbacks(
  db: D1Database,
  leadId: string
): Promise<CallbackRequest[]> {
  const result = await db
    .prepare('SELECT * FROM callback_requests WHERE lead_id = ? ORDER BY created_at DESC')
    .bind(leadId)
    .all<CallbackRequest>();

  return result.results || [];
}

// ============================================================================
// Auto-FAQ Queries
// ============================================================================

export interface AutoFaq {
  id: string;
  business_id: string;
  question: string;
  answer: string;
  frequency: number;
  source_intents: string | null;
  status: 'draft' | 'approved' | 'rejected';
  created_at: number;
  updated_at: number;
}

export async function getFaqs(
  db: D1Database,
  businessId: string,
  status?: string,
): Promise<AutoFaq[]> {
  let sql = 'SELECT * FROM auto_faqs WHERE business_id = ?';
  const params: (string | number)[] = [businessId];

  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY CASE status WHEN \'draft\' THEN 1 WHEN \'approved\' THEN 2 ELSE 3 END, frequency DESC';

  const result = await db.prepare(sql).bind(...params).all<AutoFaq>();
  return result.results || [];
}

export async function getFaqById(
  db: D1Database,
  faqId: string,
): Promise<AutoFaq | null> {
  return db.prepare('SELECT * FROM auto_faqs WHERE id = ?').bind(faqId).first<AutoFaq>();
}

export async function updateFaq(
  db: D1Database,
  faqId: string,
  updates: { status?: string; question?: string; answer?: string },
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.question !== undefined) {
    fields.push('question = ?');
    values.push(updates.question);
  }
  if (updates.answer !== undefined) {
    fields.push('answer = ?');
    values.push(updates.answer);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = unixepoch()');
  values.push(faqId);

  await db.prepare(`UPDATE auto_faqs SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
}

export async function getFaqStats(
  db: D1Database,
  businessId: string,
): Promise<{ total: number; draft: number; approved: number; rejected: number }> {
  const result = await db.prepare(
    `SELECT status, COUNT(*) as count FROM auto_faqs WHERE business_id = ? GROUP BY status`,
  ).bind(businessId).all<{ status: string; count: number }>();

  const stats = { total: 0, draft: 0, approved: 0, rejected: 0 };
  for (const row of result.results || []) {
    stats.total += row.count;
    if (row.status === 'draft') stats.draft = row.count;
    else if (row.status === 'approved') stats.approved = row.count;
    else if (row.status === 'rejected') stats.rejected = row.count;
  }
  return stats;
}
