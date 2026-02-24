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
  // Phase 6: AI enable/disable toggle
  ai_enabled: number; // 0 = disabled, 1 = enabled (default)
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
