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

export type BrandTone = 'friendly' | 'professional' | 'casual';

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

  // Phase 4: B2B tenant config
  brand_tone: BrandTone;
  greeting_template: string | null;
  escalation_keywords: string | null; // JSON array
  after_hours_message: string | null;
  handoff_email: string | null;
  handoff_phone: string | null;
  auto_handoff_threshold: number;
  ai_enabled: number; // 0 = disabled, 1 = enabled (default)

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
  message_count: number; // H7 FIX: Track messages covered for race condition prevention
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
    AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?)
  `;
  const params: (string | undefined)[] = [businessId, searchTerm, searchTerm, searchTerm];

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

/**
 * Get all products for a business (for batch embedding)
 */
export async function getAllProductsForBusiness(
  db: D1Database,
  businessId: string
): Promise<Product[]> {
  const result = await db
    .prepare('SELECT * FROM products WHERE business_id = ?')
    .bind(businessId)
    .all<Product>();

  return result.results || [];
}

/**
 * Get products by IDs (for fetching full data after semantic search)
 */
export async function getProductsByIds(
  db: D1Database,
  productIds: string[]
): Promise<ProductWithMetadata[]> {
  if (productIds.length === 0) {
    return [];
  }

  // Build parameterized query for IN clause
  const placeholders = productIds.map(() => '?').join(',');
  const result = await db
    .prepare(`SELECT * FROM products WHERE id IN (${placeholders})`)
    .bind(...productIds)
    .all<Product>();

  // Preserve the order from productIds (important for ranking)
  const productMap = new Map<string, Product>();
  for (const product of result.results || []) {
    productMap.set(product.id, product);
  }

  return productIds
    .map((id) => productMap.get(id))
    .filter((p): p is Product => p !== undefined)
    .map(parseProductMetadata);
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

/**
 * Phase 3: Get top products from each category for catalog overview
 * Returns up to `perCategory` products per category, sorted by price (popular proxy)
 */
export async function getTopProductsPerCategory(
  db: D1Database,
  businessId: string,
  perCategory: number = 2
): Promise<Map<string, ProductWithMetadata[]>> {
  // Get all categories
  const categories = await getAllCategories(db, businessId);
  const result = new Map<string, ProductWithMetadata[]>();

  // Get top products per category (in stock, sorted by price desc)
  for (const category of categories) {
    const products = await db
      .prepare(`
        SELECT * FROM products
        WHERE business_id = ? AND category = ? AND in_stock = 1
        ORDER BY price DESC
        LIMIT ?
      `)
      .bind(businessId, category, perCategory)
      .all<Product>();

    result.set(category, (products.results || []).map(parseProductMetadata));
  }

  return result;
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
  // Status thresholds based on typical 3-4 message sales conversation:
  // - engaged: >= 10 (first product inquiry)
  // - warm: >= 30 (provided preferences/size)
  // - hot: >= 55 (selected product, ready to buy)
  await db
    .prepare(`
      UPDATE leads
      SET score = MAX(0, MIN(100, score + ?)),
          status = CASE
            WHEN score + ? >= 55 THEN 'hot'
            WHEN score + ? >= 30 THEN 'warm'
            WHEN score + ? >= 10 THEN 'engaged'
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

/**
 * Upsert conversation summary with race condition protection.
 *
 * H7 FIX: Only update if messageCount > existing message_count.
 * This ensures that if two summarizations run in parallel,
 * the one based on more messages always wins.
 *
 * @returns true if summary was updated, false if skipped (stale data)
 */
export async function upsertConversationSummary(
  db: D1Database,
  leadId: string,
  summary: string,
  keyInterests: string[],
  objections: string[],
  nextSteps: string | null,
  messageCount: number // H7 FIX: Track how many messages this summary covers
): Promise<boolean> {
  const id = `summary-${leadId}`;

  // H7 FIX: Only update if new message_count > existing
  // This prevents stale summarizations from overwriting newer ones
  const result = await db
    .prepare(`
      INSERT INTO conversation_summaries (id, lead_id, summary, key_interests, objections, next_steps, message_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())
      ON CONFLICT(lead_id) DO UPDATE SET
        summary = excluded.summary,
        key_interests = excluded.key_interests,
        objections = excluded.objections,
        next_steps = excluded.next_steps,
        message_count = excluded.message_count,
        updated_at = unixepoch()
      WHERE excluded.message_count > conversation_summaries.message_count
         OR conversation_summaries.message_count IS NULL
    `)
    .bind(
      id,
      leadId,
      summary,
      JSON.stringify(keyInterests),
      JSON.stringify(objections),
      nextSteps,
      messageCount
    )
    .run();

  // Check if rows were affected (if 0, the update was skipped due to stale data)
  const updated = result.meta.changes > 0;
  if (!updated) {
    console.log(`H7: Skipped stale summary for lead ${leadId} (messageCount: ${messageCount})`);
  }
  return updated;
}

/**
 * Get leads that need summarization for background cron job.
 * Only returns leads where:
 * 1. No summary exists yet, OR
 * 2. New messages since last summary (last_contact > cs.updated_at)
 * 3. At least 5 messages (worth summarizing)
 */
export async function getLeadsNeedingSummarization(
  db: D1Database,
  limit: number = 50
): Promise<Lead[]> {
  const result = await db
    .prepare(`
      SELECT l.* FROM leads l
      LEFT JOIN conversation_summaries cs ON l.id = cs.lead_id
      WHERE l.message_count >= 5
        AND (cs.updated_at IS NULL OR l.last_contact > cs.updated_at)
      ORDER BY l.last_contact DESC
      LIMIT ?
    `)
    .bind(limit)
    .all<Lead>();

  return result.results || [];
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
// Phase 4: Tenant Config Helpers
// ============================================================================

export interface BusinessConfig {
  brandTone: BrandTone;
  greetingTemplate: string | null;
  escalationKeywords: string[];
  afterHoursMessage: string | null;
  handoffEmail: string | null;
  handoffPhone: string | null;
  autoHandoffThreshold: number;
  workingHours: Record<string, string> | null;
  timezone: string;
}

/**
 * Parse escalation keywords from JSON string
 */
export function parseEscalationKeywords(business: Business): string[] {
  if (!business.escalation_keywords) return [];
  try {
    const parsed = JSON.parse(business.escalation_keywords);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Parse working hours from JSON string
 */
export function parseWorkingHours(business: Business): Record<string, string> | null {
  if (!business.working_hours) return null;
  try {
    return JSON.parse(business.working_hours);
  } catch {
    return null;
  }
}

/**
 * Get business config with all parsed fields
 */
export function getBusinessConfig(business: Business): BusinessConfig {
  return {
    brandTone: business.brand_tone || 'friendly',
    greetingTemplate: business.greeting_template,
    escalationKeywords: parseEscalationKeywords(business),
    afterHoursMessage: business.after_hours_message,
    handoffEmail: business.handoff_email,
    handoffPhone: business.handoff_phone,
    autoHandoffThreshold: business.auto_handoff_threshold || 3,
    workingHours: parseWorkingHours(business),
    timezone: business.timezone || 'UTC',
  };
}

/**
 * Check if the current time is within business hours
 * Returns: { isOpen: boolean, nextOpen?: string }
 */
export function isWithinBusinessHours(
  business: Business,
  currentTime?: Date
): { isOpen: boolean; nextOpen?: string } {
  const workingHours = parseWorkingHours(business);
  if (!workingHours) {
    // No working hours set = always open
    return { isOpen: true };
  }

  const now = currentTime || new Date();

  // Convert to business timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: business.timezone || 'UTC',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const dayPart = parts.find(p => p.type === 'weekday')?.value?.toLowerCase() || 'mon';
  const hourPart = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minutePart = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const currentMinutes = hourPart * 60 + minutePart;

  const dayHours = workingHours[dayPart];
  if (!dayHours) {
    // Closed on this day
    return { isOpen: false, nextOpen: 'tomorrow' };
  }

  // Parse hours like "9-21" or "10-18"
  const [openStr, closeStr] = dayHours.split('-');
  const openMinutes = parseInt(openStr, 10) * 60;
  const closeMinutes = parseInt(closeStr, 10) * 60;

  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    return { isOpen: true };
  }

  if (currentMinutes < openMinutes) {
    return { isOpen: false, nextOpen: `at ${openStr}:00` };
  }

  return { isOpen: false, nextOpen: 'tomorrow' };
}

/**
 * Check if a message contains any escalation keywords
 */
export function containsEscalationKeyword(
  message: string,
  keywords: string[]
): boolean {
  if (keywords.length === 0) return false;
  const lower = message.toLowerCase();
  return keywords.some(keyword => lower.includes(keyword.toLowerCase()));
}

/**
 * Update business configuration (for dashboard settings page)
 */
export async function updateBusinessConfig(
  db: D1Database,
  businessId: string,
  config: Partial<{
    brand_tone: BrandTone;
    greeting_template: string | null;
    escalation_keywords: string[];
    after_hours_message: string | null;
    handoff_email: string | null;
    handoff_phone: string | null;
    auto_handoff_threshold: number;
    working_hours: Record<string, string> | null;
  }>
): Promise<void> {
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
    values.push(JSON.stringify(config.escalation_keywords));
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
    values.push(config.working_hours ? JSON.stringify(config.working_hours) : null);
  }

  if (updates.length === 0) return;

  updates.push('updated_at = unixepoch()');
  values.push(businessId);

  await db
    .prepare(`UPDATE businesses SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
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

// ============================================================================
// Message Events (Analytics) - Phase 3
// ============================================================================

export type ResponseAction =
  | 'show_products'
  | 'ask_clarification'
  | 'answer_question'
  | 'empathize'
  | 'greet'
  | 'thank'
  | 'handoff'
  | 'farewell';

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
  products_shown: string | null; // JSON array of product IDs
  flagged_for_human: number;
  clarification_count: number;
  processing_time_ms: number | null;
}

export interface MessageEventInput {
  id: string;
  business_id: string;
  lead_id: string;
  timestamp: number;
  action: ResponseAction;
  intent_type: string | null;
  user_message: string | null;
  agent_response: string | null;
  search_query: string | null;
  products_shown: string[] | null;
  flagged_for_human: number;
  clarification_count: number;
  processing_time_ms: number | null;
}

/**
 * Insert a new message event for analytics tracking
 */
export async function insertMessageEvent(
  db: D1Database,
  event: MessageEventInput
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO message_events (
        id, business_id, lead_id, timestamp, action, intent_type,
        user_message, agent_response, search_query, products_shown,
        flagged_for_human, clarification_count, processing_time_ms
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      event.id,
      event.business_id,
      event.lead_id,
      event.timestamp,
      event.action,
      event.intent_type,
      event.user_message,
      event.agent_response,
      event.search_query,
      event.products_shown ? JSON.stringify(event.products_shown) : null,
      event.flagged_for_human,
      event.clarification_count,
      event.processing_time_ms
    )
    .run();
}

/**
 * Get message events for a business (paginated, for dashboard)
 */
export async function getMessageEventsByBusiness(
  db: D1Database,
  businessId: string,
  options: {
    limit?: number;
    offset?: number;
    action?: ResponseAction;
    startTime?: number;
    endTime?: number;
  } = {}
): Promise<{ events: MessageEvent[]; total: number }> {
  const { limit = 50, offset = 0, action, startTime, endTime } = options;

  let whereClause = 'WHERE business_id = ?';
  const params: (string | number)[] = [businessId];

  if (action) {
    whereClause += ' AND action = ?';
    params.push(action);
  }
  if (startTime) {
    whereClause += ' AND timestamp >= ?';
    params.push(startTime);
  }
  if (endTime) {
    whereClause += ' AND timestamp <= ?';
    params.push(endTime);
  }

  // Get total count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM message_events ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>();

  // Get paginated results
  const result = await db
    .prepare(`
      SELECT * FROM message_events
      ${whereClause}
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
 * Get all events for a specific lead (for conversation detail)
 */
export async function getConversationEvents(
  db: D1Database,
  leadId: string,
  limit: number = 100
): Promise<MessageEvent[]> {
  const result = await db
    .prepare(`
      SELECT * FROM message_events
      WHERE lead_id = ?
      ORDER BY timestamp ASC
      LIMIT ?
    `)
    .bind(leadId, limit)
    .all<MessageEvent>();

  return result.results || [];
}

/**
 * Get analytics summary for dashboard
 */
export async function getAnalyticsSummary(
  db: D1Database,
  businessId: string,
  startTime: number,
  endTime: number
): Promise<{
  totalMessages: number;
  actionBreakdown: Record<ResponseAction, number>;
  avgProcessingTime: number;
  handoffRate: number;
  uniqueLeads: number;
}> {
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
    handoff: 0,
    farewell: 0
  };

  for (const row of actionResult.results || []) {
    actionBreakdown[row.action] = row.count;
  }

  return {
    totalMessages,
    actionBreakdown,
    avgProcessingTime: avgTimeResult?.avg_time || 0,
    handoffRate: totalMessages > 0
      ? (handoffResult?.count || 0) / totalMessages
      : 0,
    uniqueLeads: leadsResult?.count || 0
  };
}

/**
 * Get leads for a business (for dashboard leads list)
 */
export async function getLeadsByBusiness(
  db: D1Database,
  businessId: string,
  options: {
    limit?: number;
    offset?: number;
    status?: Lead['status'];
    sortBy?: 'last_contact' | 'score' | 'first_contact';
    sortOrder?: 'ASC' | 'DESC';
  } = {}
): Promise<{ leads: Lead[]; total: number }> {
  const {
    limit = 50,
    offset = 0,
    status,
    sortBy = 'last_contact',
    sortOrder = 'DESC'
  } = options;

  let whereClause = 'WHERE business_id = ?';
  const params: (string | number)[] = [businessId];

  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }

  // Get total count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM leads ${whereClause}`)
    .bind(...params)
    .first<{ count: number }>();

  // Get paginated results
  const result = await db
    .prepare(`
      SELECT * FROM leads
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
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
 * Get lead by ID with conversation summary
 */
export async function getLeadWithSummary(
  db: D1Database,
  leadId: string
): Promise<{ lead: Lead; summary: ConversationSummary | null } | null> {
  const lead = await db
    .prepare('SELECT * FROM leads WHERE id = ?')
    .bind(leadId)
    .first<Lead>();

  if (!lead) return null;

  const summary = await getConversationSummary(db, leadId);

  return { lead, summary };
}
