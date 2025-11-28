/**
 * Database query functions for D1
 * All database operations are centralized here for maintainability
 */

// ============================================================================
// Types
// ============================================================================

export interface Business {
  id: string;
  name: string;
  whatsapp_phone_id: string;
  system_prompt: string | null;
  working_hours: string | null;
  timezone: string;
  language: string;
  created_at: number;
  updated_at: number;
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
  metadata: string | null; // JSON string
  created_at: number;
  updated_at: number;
}

export interface ProductWithMetadata extends Omit<Product, 'metadata'> {
  metadata: Record<string, unknown> | null;
}

export interface Lead {
  id: string;
  business_id: string;
  whatsapp_number: string;
  name: string | null;
  score: number;
  status: 'new' | 'engaged' | 'warm' | 'hot' | 'converted' | 'lost';
  tags: string | null; // JSON array
  first_contact: number;
  last_contact: number;
  message_count: number;
  notes: string | null;
}

export interface ConversationSummary {
  id: string;
  lead_id: string;
  summary: string | null;
  key_interests: string | null; // JSON array
  objections: string | null; // JSON array
  next_steps: string | null;
  updated_at: number;
}

export interface HumanFlag {
  id: string;
  lead_id: string;
  urgency: 'low' | 'medium' | 'high';
  reason: string;
  resolved: number;
  created_at: number;
  resolved_at: number | null;
}

// ============================================================================
// Business Queries
// ============================================================================

export async function getBusinessByPhoneId(
  db: D1Database,
  phoneId: string
): Promise<Business | null> {
  const result = await db
    .prepare('SELECT * FROM businesses WHERE whatsapp_phone_id = ?')
    .bind(phoneId)
    .first<Business>();
  return result;
}

export async function getBusinessById(
  db: D1Database,
  id: string
): Promise<Business | null> {
  const result = await db
    .prepare('SELECT * FROM businesses WHERE id = ?')
    .bind(id)
    .first<Business>();
  return result;
}

// ============================================================================
// Product Queries
// ============================================================================

export async function searchProducts(
  db: D1Database,
  businessId: string,
  query: string,
  category?: string
): Promise<ProductWithMetadata[]> {
  const searchTerm = `%${query.toLowerCase()}%`;

  let sql = `
    SELECT * FROM products
    WHERE business_id = ?
    AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)
  `;
  const params: (string | undefined)[] = [businessId, searchTerm, searchTerm];

  if (category) {
    sql += ' AND LOWER(category) = ?';
    params.push(category.toLowerCase());
  }

  sql += ' LIMIT 10';

  const result = await db
    .prepare(sql)
    .bind(...params)
    .all<Product>();

  return (result.results || []).map(parseProductMetadata);
}

export async function getProductById(
  db: D1Database,
  productId: string
): Promise<ProductWithMetadata | null> {
  const result = await db
    .prepare('SELECT * FROM products WHERE id = ?')
    .bind(productId)
    .first<Product>();

  return result ? parseProductMetadata(result) : null;
}

export async function getProductsByCategory(
  db: D1Database,
  businessId: string,
  category: string
): Promise<ProductWithMetadata[]> {
  const result = await db
    .prepare('SELECT * FROM products WHERE business_id = ? AND LOWER(category) = ? AND in_stock = 1')
    .bind(businessId, category.toLowerCase())
    .all<Product>();

  return (result.results || []).map(parseProductMetadata);
}

export async function checkProductAvailability(
  db: D1Database,
  productId: string,
  quantity: number = 1
): Promise<{ available: boolean; stock: number | null; product: ProductWithMetadata | null }> {
  const product = await getProductById(db, productId);

  if (!product) {
    return { available: false, stock: null, product: null };
  }

  const available = product.in_stock === 1 &&
    (product.stock_quantity === null || product.stock_quantity >= quantity);

  return {
    available,
    stock: product.stock_quantity,
    product
  };
}

export async function getAllCategories(
  db: D1Database,
  businessId: string
): Promise<string[]> {
  const result = await db
    .prepare('SELECT DISTINCT category FROM products WHERE business_id = ? AND category IS NOT NULL')
    .bind(businessId)
    .all<{ category: string }>();

  return (result.results || []).map((r: { category: string }) => r.category);
}

function parseProductMetadata(product: Product): ProductWithMetadata {
  return {
    ...product,
    metadata: product.metadata ? JSON.parse(product.metadata) : null
  };
}

// ============================================================================
// Lead Queries
// ============================================================================

export async function getOrCreateLead(
  db: D1Database,
  businessId: string,
  whatsappNumber: string
): Promise<Lead> {
  // Try to get existing lead
  const existing = await db
    .prepare('SELECT * FROM leads WHERE business_id = ? AND whatsapp_number = ?')
    .bind(businessId, whatsappNumber)
    .first<Lead>();

  if (existing) {
    // Update last contact and increment message count
    await db
      .prepare('UPDATE leads SET last_contact = unixepoch(), message_count = message_count + 1 WHERE id = ?')
      .bind(existing.id)
      .run();

    return {
      ...existing,
      last_contact: Math.floor(Date.now() / 1000),
      message_count: existing.message_count + 1
    };
  }

  // Create new lead
  const id = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  await db
    .prepare(`
      INSERT INTO leads (id, business_id, whatsapp_number, score, status, message_count)
      VALUES (?, ?, ?, 0, 'new', 1)
    `)
    .bind(id, businessId, whatsappNumber)
    .run();

  return {
    id,
    business_id: businessId,
    whatsapp_number: whatsappNumber,
    name: null,
    score: 0,
    status: 'new',
    tags: null,
    first_contact: Math.floor(Date.now() / 1000),
    last_contact: Math.floor(Date.now() / 1000),
    message_count: 1,
    notes: null
  };
}

export async function updateLeadScore(
  db: D1Database,
  leadId: string,
  scoreDelta: number,
  reason: string
): Promise<void> {
  // Clamp score between 0 and 100
  await db
    .prepare(`
      UPDATE leads
      SET score = MAX(0, MIN(100, score + ?)),
          status = CASE
            WHEN score + ? >= 80 THEN 'hot'
            WHEN score + ? >= 50 THEN 'warm'
            WHEN score + ? >= 20 THEN 'engaged'
            ELSE status
          END,
          notes = COALESCE(notes, '') || ? || char(10)
      WHERE id = ?
    `)
    .bind(scoreDelta, scoreDelta, scoreDelta, scoreDelta, `[${new Date().toISOString()}] Score ${scoreDelta >= 0 ? '+' : ''}${scoreDelta}: ${reason}`, leadId)
    .run();
}

export async function updateLeadName(
  db: D1Database,
  leadId: string,
  name: string
): Promise<void> {
  await db
    .prepare('UPDATE leads SET name = ? WHERE id = ?')
    .bind(name, leadId)
    .run();
}

// ============================================================================
// Conversation Summary Queries
// ============================================================================

export async function getConversationSummary(
  db: D1Database,
  leadId: string
): Promise<ConversationSummary | null> {
  return db
    .prepare('SELECT * FROM conversation_summaries WHERE lead_id = ?')
    .bind(leadId)
    .first<ConversationSummary>();
}

export async function upsertConversationSummary(
  db: D1Database,
  leadId: string,
  summary: string,
  keyInterests: string[],
  objections: string[],
  nextSteps: string | null
): Promise<void> {
  const id = `summary-${leadId}`;

  await db
    .prepare(`
      INSERT INTO conversation_summaries (id, lead_id, summary, key_interests, objections, next_steps, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(lead_id) DO UPDATE SET
        summary = excluded.summary,
        key_interests = excluded.key_interests,
        objections = excluded.objections,
        next_steps = excluded.next_steps,
        updated_at = unixepoch()
    `)
    .bind(
      id,
      leadId,
      summary,
      JSON.stringify(keyInterests),
      JSON.stringify(objections),
      nextSteps
    )
    .run();
}

// ============================================================================
// Human Flag Queries
// ============================================================================

export async function createHumanFlag(
  db: D1Database,
  leadId: string,
  urgency: 'low' | 'medium' | 'high',
  reason: string
): Promise<void> {
  const id = `flag-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  await db
    .prepare(`
      INSERT INTO human_flags (id, lead_id, urgency, reason)
      VALUES (?, ?, ?, ?)
    `)
    .bind(id, leadId, urgency, reason)
    .run();
}

export async function getUnresolvedFlags(
  db: D1Database,
  businessId: string
): Promise<(HumanFlag & { lead: Lead })[]> {
  const result = await db
    .prepare(`
      SELECT hf.*, l.* as lead
      FROM human_flags hf
      JOIN leads l ON hf.lead_id = l.id
      WHERE l.business_id = ? AND hf.resolved = 0
      ORDER BY
        CASE hf.urgency
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        hf.created_at DESC
    `)
    .bind(businessId)
    .all();

  // Note: This is a simplified version - in production you'd want proper JOIN handling
  return result.results as unknown as (HumanFlag & { lead: Lead })[];
}
