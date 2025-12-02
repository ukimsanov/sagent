/**
 * Database query functions for D1
 * All database operations are centralized here for maintainability
 */

// ============================================================================
// Types
// ============================================================================

export type GoalType =
  | 'store_visit'      // Encourage physical store visits
  | 'lead_capture'     // Collect email/name/contact preference
  | 'callback_request' // Customer wants a call back
  | 'appointment'      // Book consultation/fitting
  | 'online_order'     // Ready to buy online → flag for human
  | 'promo_delivery';  // Send discount code

export interface Business {
  id: string;
  name: string;
  whatsapp_phone_id: string;
  system_prompt: string | null;
  working_hours: string | null;
  timezone: string;
  language: string;
  address: string | null;
  goals: string | null; // JSON array of GoalType
  created_at: number;
  updated_at: number;
}

export interface BusinessWithGoals extends Omit<Business, 'goals'> {
  goals: GoalType[];
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
  image_url: string | null; // JSON array: '["url1", "url2"]'
  created_at: number;
  updated_at: number;
}

export interface ProductWithMetadata extends Omit<Product, 'metadata' | 'image_url'> {
  metadata: Record<string, unknown> | null;
  image_url: string | null; // Raw field (JSON array string)
  image_urls: string[]; // Parsed array of image URLs
}

export interface Lead {
  id: string;
  business_id: string;
  whatsapp_number: string;
  name: string | null;
  email: string | null;
  preferred_contact: 'whatsapp' | 'phone' | 'email' | null;
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

export interface CallbackRequest {
  id: string;
  lead_id: string;
  business_id: string;
  preferred_time: string | null;
  reason: string | null;
  status: 'pending' | 'completed';
  created_at: number;
}

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
    metadata: product.metadata ? JSON.parse(product.metadata) : null,
    image_urls: parseImageUrls(product.image_url)
  };
}

/**
 * Parse image_url field which is always a JSON array
 * '["url1", "url2"]' → ["url1", "url2"]
 * null → []
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
    email: null,
    preferred_contact: null,
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

// ============================================================================
// Business Goals Helper
// ============================================================================

export function parseBusinessGoals(business: Business): GoalType[] {
  if (!business.goals) return [];
  try {
    const parsed = JSON.parse(business.goals);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ============================================================================
// Lead Capture Queries
// ============================================================================

export async function updateLeadInfo(
  db: D1Database,
  leadId: string,
  info: {
    name?: string;
    email?: string;
    preferred_contact?: 'whatsapp' | 'phone' | 'email';
  }
): Promise<void> {
  const updates: string[] = [];
  const values: (string | undefined)[] = [];

  if (info.name !== undefined) {
    updates.push('name = ?');
    values.push(info.name);
  }
  if (info.email !== undefined) {
    updates.push('email = ?');
    values.push(info.email);
  }
  if (info.preferred_contact !== undefined) {
    updates.push('preferred_contact = ?');
    values.push(info.preferred_contact);
  }

  if (updates.length === 0) return;

  values.push(leadId);
  await db
    .prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

// ============================================================================
// Appointment Queries
// ============================================================================

export async function createAppointment(
  db: D1Database,
  leadId: string,
  businessId: string,
  requestedDate: string | null,
  requestedTime: string | null,
  notes: string | null
): Promise<Appointment> {
  const id = `apt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  await db
    .prepare(`
      INSERT INTO appointments (id, lead_id, business_id, requested_date, requested_time, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(id, leadId, businessId, requestedDate, requestedTime, notes)
    .run();

  return {
    id,
    lead_id: leadId,
    business_id: businessId,
    requested_date: requestedDate,
    requested_time: requestedTime,
    notes,
    status: 'pending',
    created_at: Math.floor(Date.now() / 1000)
  };
}

// ============================================================================
// Callback Request Queries
// ============================================================================

export async function createCallbackRequest(
  db: D1Database,
  leadId: string,
  businessId: string,
  preferredTime: string | null,
  reason: string | null
): Promise<CallbackRequest> {
  const id = `cb-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  await db
    .prepare(`
      INSERT INTO callback_requests (id, lead_id, business_id, preferred_time, reason)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(id, leadId, businessId, preferredTime, reason)
    .run();

  return {
    id,
    lead_id: leadId,
    business_id: businessId,
    preferred_time: preferredTime,
    reason,
    status: 'pending',
    created_at: Math.floor(Date.now() / 1000)
  };
}

// ============================================================================
// Promo Code Queries
// ============================================================================

export async function getUnusedPromoCode(
  db: D1Database,
  businessId: string
): Promise<PromoCode | null> {
  const now = Math.floor(Date.now() / 1000);

  return db
    .prepare(`
      SELECT * FROM promo_codes
      WHERE business_id = ?
        AND used_by_lead_id IS NULL
        AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY created_at ASC
      LIMIT 1
    `)
    .bind(businessId, now)
    .first<PromoCode>();
}

export async function markPromoCodeUsed(
  db: D1Database,
  promoCodeId: string,
  leadId: string
): Promise<void> {
  await db
    .prepare('UPDATE promo_codes SET used_by_lead_id = ? WHERE id = ?')
    .bind(leadId, promoCodeId)
    .run();
}

export async function createPromoCode(
  db: D1Database,
  businessId: string,
  code: string,
  discountPercent: number | null,
  discountAmount: number | null,
  expiresAt: number | null
): Promise<PromoCode> {
  const id = `promo-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  await db
    .prepare(`
      INSERT INTO promo_codes (id, business_id, code, discount_percent, discount_amount, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .bind(id, businessId, code, discountPercent, discountAmount, expiresAt)
    .run();

  return {
    id,
    business_id: businessId,
    code,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    used_by_lead_id: null,
    expires_at: expiresAt,
    created_at: Math.floor(Date.now() / 1000)
  };
}
