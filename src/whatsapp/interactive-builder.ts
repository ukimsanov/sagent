/**
 * Interactive Message Builder
 *
 * Pure-function module that decides what message format to use
 * and builds the appropriate payload structure.
 *
 * Handles WhatsApp character limit enforcement and graceful degradation.
 * If interactive data is missing or invalid, falls back to plain text.
 */

// ============================================================================
// Types
// ============================================================================

export interface SendPlanInput {
  message: string;
  replyType?: 'text' | 'buttons' | 'list' | null;
  replyOptions?: Array<{ id: string; title: string; description?: string | null }>;
  productsForList?: Array<{ id: string; name: string; price: string; category: string }>;
}

export type SendPlan =
  | { type: 'text'; text: string }
  | { type: 'buttons'; bodyText: string; buttons: Array<{ id: string; title: string }> }
  | { type: 'list'; bodyText: string; buttonText: string; sections: Array<ListSection> };

export interface ListSection {
  title: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

// ============================================================================
// WhatsApp Limits
// ============================================================================

const LIMITS = {
  BODY_TEXT: 1024,
  BUTTON_TITLE: 20,
  LIST_BUTTON_TEXT: 20,
  LIST_SECTION_TITLE: 24,
  LIST_ROW_TITLE: 24,
  LIST_ROW_DESCRIPTION: 72,
  MAX_BUTTONS: 3,
  MAX_LIST_ROWS: 10,
} as const;

// ============================================================================
// Main Builder
// ============================================================================

/**
 * Build a send plan based on the handler response data.
 * Returns a discriminated union that the caller can switch on.
 *
 * Degradation rules:
 * - buttons with 0 options → text
 * - buttons with >3 options → text (WhatsApp limit)
 * - list with 0 products → text
 * - any missing data → text
 */
export function buildSendPlan(input: SendPlanInput): SendPlan {
  const { message, replyType, replyOptions, productsForList } = input;

  // Buttons
  if (replyType === 'buttons' && replyOptions && replyOptions.length > 0) {
    return buildButtonPlan(message, replyOptions);
  }

  // List (from products)
  if (replyType === 'list' && productsForList && productsForList.length > 0) {
    return buildListPlan(message, productsForList);
  }

  // Default: plain text
  return { type: 'text', text: message };
}

// ============================================================================
// Button Plan
// ============================================================================

function buildButtonPlan(
  message: string,
  options: Array<{ id: string; title: string; description?: string | null }>
): SendPlan {
  // WhatsApp allows max 3 buttons
  if (options.length > LIMITS.MAX_BUTTONS) {
    console.warn(`Buttons exceed max (${options.length}>${LIMITS.MAX_BUTTONS}), falling back to text`);
    return { type: 'text', text: message };
  }

  const buttons = options.map(opt => ({
    id: opt.id,
    title: truncate(opt.title, LIMITS.BUTTON_TITLE),
  }));

  return {
    type: 'buttons',
    bodyText: truncate(message, LIMITS.BODY_TEXT),
    buttons,
  };
}

// ============================================================================
// List Plan (from products)
// ============================================================================

function buildListPlan(
  message: string,
  products: Array<{ id: string; name: string; price: string; category: string }>
): SendPlan {
  // Group products by category
  const grouped = new Map<string, typeof products>();
  for (const product of products) {
    const category = product.category || 'Products';
    const existing = grouped.get(category) || [];
    existing.push(product);
    grouped.set(category, existing);
  }

  const sections: ListSection[] = [];
  let totalRows = 0;

  for (const [category, items] of grouped) {
    if (totalRows >= LIMITS.MAX_LIST_ROWS) break;

    const rows = items
      .slice(0, LIMITS.MAX_LIST_ROWS - totalRows)
      .map(p => ({
        id: `product:${p.id}`,
        title: smartTruncateProductName(p.name, LIMITS.LIST_ROW_TITLE),
        description: truncate(`${p.price}`, LIMITS.LIST_ROW_DESCRIPTION),
      }));

    if (rows.length > 0) {
      sections.push({
        title: truncate(category, LIMITS.LIST_SECTION_TITLE),
        rows,
      });
      totalRows += rows.length;
    }
  }

  if (sections.length === 0) {
    return { type: 'text', text: message };
  }

  return {
    type: 'list',
    bodyText: truncate(message, LIMITS.BODY_TEXT),
    buttonText: 'View Products',
    sections,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 1) + '…';
}

/**
 * Smart product name truncation for WhatsApp list rows (24 char limit).
 * Instead of cutting mid-word, abbreviates common patterns:
 * "GYMSHARK X CARLOS BELCAST ZIP UP HOODIE - GS BLACK" → "Carlos Belcast Zip - BK"
 * "STRAIGHT LEG TRACKSUIT PANT" → "Straight Leg Track Pant"
 */
function smartTruncateProductName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;

  // Remove brand prefixes that waste space
  let shortened = name
    .replace(/^GYMSHARK\s*X\s*/i, '')
    .replace(/\s*-\s*GS\s+/i, ' - ')
    .replace(/\s*-\s*$/, '');

  // Title case for readability
  shortened = shortened
    .split(/\s+/)
    .map(w => {
      if (w === '-' || w === 'X' || w === '&') return w;
      if (w.length <= 3) return w.toUpperCase(); // Keep short words like "GS", "XL" uppercase
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');

  if (shortened.length <= maxLength) return shortened;

  // Remove filler words
  shortened = shortened
    .replace(/\b(Up|The|And|For|With)\b\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (shortened.length <= maxLength) return shortened;

  // Abbreviate common clothing words
  shortened = shortened
    .replace(/Hoodie/i, 'Hood')
    .replace(/Tracksuit/i, 'Track')
    .replace(/T-shirt/i, 'Tee')
    .replace(/Sweatshirt/i, 'Sweat')
    .replace(/Black/i, 'BLK')
    .replace(/White/i, 'WHT')
    .replace(/Grey/i, 'GRY')
    .replace(/Onyx/i, 'ONX');

  if (shortened.length <= maxLength) return shortened;

  // Final fallback: truncate at word boundary
  const words = shortened.split(' ');
  let result = '';
  for (const word of words) {
    const candidate = result ? `${result} ${word}` : word;
    if (candidate.length > maxLength - 1) break;
    result = candidate;
  }
  return result || truncate(shortened, maxLength);
}
