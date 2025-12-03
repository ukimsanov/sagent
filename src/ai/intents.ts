/**
 * Intent Classification Module
 *
 * Rule-based intent classification for the code-first handler.
 * No LLM needed - uses pattern matching and heuristics.
 */

// ============================================================================
// Types
// ============================================================================

export type IntentType =
  | 'greeting'
  | 'thanks'
  | 'handoff_request'
  | 'product_search'
  | 'sizing_help'
  | 'pricing_question'
  | 'order_status'
  | 'complaint'
  | 'recommendation'
  | 'comparison';

export type Intent =
  | { type: 'greeting' }
  | { type: 'thanks' }
  | { type: 'handoff_request' }
  | { type: 'product_search'; query: string }
  | { type: 'sizing_help'; query: string }
  | { type: 'pricing_question'; query: string }
  | { type: 'order_status' }
  | { type: 'complaint'; severity: 'low' | 'medium' | 'high' }
  | { type: 'recommendation'; context: string }
  | { type: 'comparison'; items: string[] };

export interface ConversationContext {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  recentClarifications: number; // How many clarifying questions we've asked recently
}

// ============================================================================
// Main Classification Function
// ============================================================================

/**
 * Classify user intent based on message text and conversation context.
 * Rule-based, no LLM needed.
 */
export function classifyIntent(
  text: string,
  context?: ConversationContext
): Intent {
  const lower = text.toLowerCase().trim();
  const history = context?.history || [];

  // 1. Check for frustration/complaint first (high priority)
  const complaint = detectComplaint(lower, text);
  if (complaint) return complaint;

  // 2. Handoff request (explicit ask for human)
  if (isHandoffRequest(lower)) {
    return { type: 'handoff_request' };
  }

  // 3. Order status inquiry
  if (isOrderStatusQuery(lower)) {
    return { type: 'order_status' };
  }

  // 4. Greetings (must be at start of message)
  if (isGreeting(lower)) {
    return { type: 'greeting' };
  }

  // 5. Thanks (must be at start of message)
  if (isThanks(lower)) {
    return { type: 'thanks' };
  }

  // 6. Sizing help
  const sizingQuery = detectSizingHelp(lower);
  if (sizingQuery) {
    return { type: 'sizing_help', query: sizingQuery };
  }

  // 7. Pricing question
  const pricingQuery = detectPricingQuestion(lower);
  if (pricingQuery) {
    return { type: 'pricing_question', query: pricingQuery };
  }

  // 8. Comparison request
  const comparisonItems = detectComparison(lower);
  if (comparisonItems) {
    return { type: 'comparison', items: comparisonItems };
  }

  // 9. Recommendation request
  const recommendationContext = detectRecommendation(lower, history);
  if (recommendationContext) {
    return { type: 'recommendation', context: recommendationContext };
  }

  // 10. Default: product search
  const query = extractSearchQuery(text, history);
  return { type: 'product_search', query };
}

// ============================================================================
// Intent Detection Functions
// ============================================================================

function isGreeting(text: string): boolean {
  return /^(hi|hello|hey|hola|good morning|good afternoon|good evening|yo|sup|what'?s up)\b/.test(text);
}

function isThanks(text: string): boolean {
  return /^(thanks|thank you|thx|ty|appreciate it|cheers)\b/.test(text);
}

function isHandoffRequest(text: string): boolean {
  return /\b(human|agent|person|representative|talk to someone|speak to someone|real person|manager|supervisor)\b/.test(text);
}

function isOrderStatusQuery(text: string): boolean {
  return /\b(order|tracking|shipment|delivery|where'?s my|when will|shipped|package)\b/.test(text) &&
         /\b(status|track|where|when|arrive|arriving|received)\b/.test(text);
}

function detectComplaint(lower: string, original: string): Intent | null {
  // High severity signals
  const highSeverity = [
    /\b(scam|fraud|sue|lawyer|refund|money back|terrible|horrible|worst|furious|disgusted)\b/,
    /\b(never (again|buying|shopping)|hate|rip( |-)?off)\b/,
  ];

  // Medium severity signals
  const mediumSeverity = [
    /\b(disappointed|frustrat|annoy|upset|unhappy|problem|issue|wrong|broken|defective)\b/,
    /\b(not (working|happy|satisfied)|doesn'?t work|poor quality)\b/,
  ];

  // Low severity signals
  const lowSeverity = [
    /\b(confused|don'?t understand|unclear|didn'?t (get|receive))\b/,
  ];

  // ALL CAPS detection (frustration signal)
  const capsRatio = (original.match(/[A-Z]/g) || []).length / original.length;
  const isAllCaps = capsRatio > 0.7 && original.length > 10;

  // Check severity levels
  if (highSeverity.some(p => p.test(lower)) || isAllCaps) {
    return { type: 'complaint', severity: 'high' };
  }

  if (mediumSeverity.some(p => p.test(lower))) {
    return { type: 'complaint', severity: 'medium' };
  }

  if (lowSeverity.some(p => p.test(lower))) {
    return { type: 'complaint', severity: 'low' };
  }

  return null;
}

function detectSizingHelp(text: string): string | null {
  const sizingPatterns = [
    /\b(what size|which size|size (chart|guide)|sizing|fit|runs (big|small|large|tight))\b/,
    /\b(too (big|small|tight|loose)|doesn'?t fit)\b/,
    /\b(should i (get|order)|recommend.* size)\b/,
    /\b(measurements|dimensions|length|width)\b/,
  ];

  if (sizingPatterns.some(p => p.test(text))) {
    // Extract what item they're asking about sizing for
    const itemMatch = text.match(/\b(hoodie|jeans|pants|shirt|t-shirt|jacket|dress|shorts|sweater)\b/i);
    return itemMatch ? itemMatch[0] : 'general';
  }

  return null;
}

function detectPricingQuestion(text: string): string | null {
  const pricingPatterns = [
    /\b(how much|price|cost|pricing|expensive|cheap|affordable|budget)\b/,
    /\b(discount|sale|promo|coupon|deal|offer|percentage off)\b/,
    /\b(under|below|less than|within|around) \$?\d+/,
  ];

  if (pricingPatterns.some(p => p.test(text))) {
    // Extract what they're asking price for
    const itemMatch = text.match(/\b(hoodie|jeans|pants|shirt|t-shirt|jacket|dress|shorts|sweater|everything|all)\b/i);
    return itemMatch ? itemMatch[0] : 'general';
  }

  return null;
}

function detectComparison(text: string): string[] | null {
  const comparisonPatterns = [
    /\b(difference|compare|comparison|vs|versus|or|between)\b.*\b(and|or|vs)\b/,
    /\bwhich (one|is better|should i)\b/,
  ];

  if (comparisonPatterns.some(p => p.test(text))) {
    // Try to extract the items being compared
    const items = text.match(/\b(hoodie|jeans|pants|shirt|jacket|dress|black|white|blue|red|small|medium|large)\b/gi);
    if (items && items.length >= 2) {
      return [...new Set(items.map(i => i.toLowerCase()))];
    }
    return ['item1', 'item2']; // Generic comparison
  }

  return null;
}

function detectRecommendation(
  text: string,
  history: Array<{ role: string; content: string }>
): string | null {
  const recommendationPatterns = [
    /\b(suggest|recommend|what (do you|should i)|help me (choose|pick|find))\b/,
    /\b(what'?s (good|best|popular)|any (suggestions|recommendations))\b/,
    /\b(not sure|don'?t know what)\b/,
  ];

  if (recommendationPatterns.some(p => p.test(text))) {
    // Extract context for recommendation
    const occasionMatch = text.match(/\b(wedding|party|work|casual|date|gym|beach|formal)\b/i);
    if (occasionMatch) return occasionMatch[0];

    const styleMatch = text.match(/\b(streetwear|minimalist|classic|trendy|vintage|sporty)\b/i);
    if (styleMatch) return styleMatch[0];

    // Check history for context
    const lastUserMessage = [...history].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      const contextMatch = lastUserMessage.content.match(/\b(hoodie|jeans|shirt|dress|outfit)\b/i);
      if (contextMatch) return contextMatch[0];
    }

    return 'general';
  }

  return null;
}

// ============================================================================
// Query Extraction
// ============================================================================

/**
 * Extract the actual product search terms from a message.
 * Handles contextual references and conversational prefixes.
 */
export function extractSearchQuery(
  text: string,
  history?: Array<{ role: string; content: string }>
): string {
  let query = text.toLowerCase().trim();

  // Check for contextual follow-up patterns
  const contextualPatterns = [
    /^what (goes|pairs|matches|looks good) with (that|this|it|them)\??$/i,
    /^(something|anything) (to go|that goes|to match|that matches) with (that|this|it|them)\??$/i,
    /^(and|what about) (pants|jeans|shoes|accessories|tops|bottoms) (to go with|for) (that|this|it|them)\??$/i,
    /^(the|that) (first|second|last|other) one\??$/i,
    /^(more like (that|this)|similar|something else)\??$/i,
  ];

  const isContextualFollowUp = contextualPatterns.some(p => p.test(query));

  if (isContextualFollowUp && history && history.length > 0) {
    return resolveContextualReference(query, history);
  }

  // Remove common conversational prefixes
  const prefixes = [
    /^(can you )?(please )?(show me|let me see|i('d)? (want|like|need) (to see)?|do you have|got any|looking for|searching for|find me|get me)\s*/i,
    /^(i('m)? (interested in|looking for))\s*/i,
    /^(what|which) .* do you have\??$/i,
    /^(any|some)\b\s*/i,
    /^something (for|to wear to|to go with)\s*/i,
  ];

  for (const prefix of prefixes) {
    query = query.replace(prefix, '');
  }

  // Clean up
  query = query.replace(/\?+$/, '').replace(/^(a|an|the)\s+/i, '').trim();

  return query || text;
}

/**
 * Resolve contextual references like "that one" or "something to match"
 */
function resolveContextualReference(
  query: string,
  history: Array<{ role: string; content: string }>
): string {
  const lastAssistantMessage = [...history]
    .reverse()
    .find(m => m.role === 'assistant');

  if (!lastAssistantMessage) {
    return 'popular items';
  }

  const content = lastAssistantMessage.content.toLowerCase();

  // Detect what was discussed and suggest complementary items
  if (content.includes('hoodie') || content.includes('sweatshirt')) {
    return 'jeans pants';
  }
  if (content.includes('jeans') || content.includes('pants')) {
    return 't-shirts tops';
  }
  if (content.includes('t-shirt') || content.includes('tee') || content.includes('top')) {
    return 'jeans pants';
  }
  if (content.includes('dress')) {
    return 'accessories shoes';
  }
  if (content.includes('jacket')) {
    return 't-shirts jeans';
  }

  // Default: broader search for complementary items
  return 'jeans pants accessories';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if we should trigger auto-handoff based on conversation state.
 * Returns true if too many clarifications or frustration detected.
 */
export function shouldAutoHandoff(context: ConversationContext): boolean {
  // Auto-handoff after 3+ clarifying questions
  if (context.recentClarifications >= 3) {
    return true;
  }

  // Check for repeated similar messages (frustration signal)
  const lastThreeUser = context.history
    .filter(m => m.role === 'user')
    .slice(-3);

  if (lastThreeUser.length >= 3) {
    const messages = lastThreeUser.map(m => m.content.toLowerCase());
    // If all 3 are very similar, likely frustrated
    const firstWords = messages.map(m => m.split(' ').slice(0, 3).join(' '));
    if (new Set(firstWords).size === 1) {
      return true;
    }
  }

  return false;
}

/**
 * Determine if the query is too vague and needs clarification.
 */
export function isVagueQuery(query: string): boolean {
  const vaguePatterns = [
    /^(something|anything|stuff|things|clothes|items|products)$/i,
    /^(new|latest|popular|trending|best)$/i,
    /^(gift|present|for someone)$/i,
    /^(help|show me|what do you have)$/i,
  ];

  return vaguePatterns.some(p => p.test(query.trim()));
}

/**
 * Get a clarifying question for a vague query.
 */
export function getClarifyingQuestion(query: string, context?: string): string {
  // Context-aware clarifying questions
  if (query.includes('gift') || query.includes('present')) {
    return "Nice! Who's the gift for? That'll help me suggest something perfect.";
  }

  if (query.includes('something') || query.includes('anything')) {
    return "Sure thing! What kind of style are you going for - casual, streetwear, or something dressier?";
  }

  if (query.includes('new') || query.includes('latest')) {
    return "We've got some fresh stuff in! Looking for tops, bottoms, or maybe outerwear?";
  }

  // Generic fallback
  return "Got it! What's the occasion - everyday wear, something special, or just updating your wardrobe?";
}
