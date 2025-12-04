/**
 * Lead Scoring Module (Phase 5)
 *
 * Automatically scores leads based on their interactions.
 * Runs in background via ctx.waitUntil() after each message.
 *
 * Scoring Factors:
 * - Intent types (product search, recommendation = high interest)
 * - Actions (show_products = engagement, clarification = needs help)
 * - Conversation patterns (multiple messages = engaged)
 * - Time-based (quick responses = high interest)
 */

import type { ResponseAction } from '../db/queries';

// ============================================================================
// Types
// ============================================================================

export interface ScoringContext {
  intentType: string | null;
  action: ResponseAction;
  messageCount: number;
  productsShown: number;
  clarificationCount: number;
  flaggedForHuman: boolean;
  processingTimeMs: number;
  previousScore: number;
}

export interface ScoreUpdate {
  delta: number;
  reason: string;
  newStatus: 'new' | 'engaged' | 'warm' | 'hot' | 'converted' | null;
}

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Calculate lead score delta based on interaction.
 * Returns score change and reason.
 */
export function calculateScoreDelta(ctx: ScoringContext): ScoreUpdate {
  let delta = 0;
  const reasons: string[] = [];

  // Intent-based scoring
  const intentScores: Record<string, number> = {
    product_search: 5,
    recommendation: 8,
    comparison: 10, // Comparing = close to buying
    pricing_question: 7,
    sizing_help: 8, // Sizing = planning to buy
    greeting: 1,
    thanks: 2,
    handoff_request: 3, // They want help = engaged
    order_status: 5, // They bought before
    complaint: -2, // Negative experience
  };

  if (ctx.intentType && intentScores[ctx.intentType]) {
    const score = intentScores[ctx.intentType];
    delta += score;
    reasons.push(`${ctx.intentType}: ${score > 0 ? '+' : ''}${score}`);
  }

  // Action-based scoring
  const actionScores: Record<ResponseAction, number> = {
    show_products: 5, // They saw products
    ask_clarification: 1, // Still exploring
    answer_question: 3, // Got info they needed
    empathize: 0, // Complaint handled
    greet: 0, // Just starting
    thank: 2, // Positive ending
    handoff: 2, // Needs more help
  };

  if (ctx.action) {
    const score = actionScores[ctx.action];
    delta += score;
    if (score !== 0) {
      reasons.push(`action ${ctx.action}: ${score > 0 ? '+' : ''}${score}`);
    }
  }

  // Products shown bonus
  if (ctx.productsShown > 0) {
    const productBonus = Math.min(ctx.productsShown * 2, 10);
    delta += productBonus;
    reasons.push(`viewed ${ctx.productsShown} products: +${productBonus}`);
  }

  // Engagement patterns
  if (ctx.messageCount >= 5 && ctx.messageCount < 10) {
    delta += 5;
    reasons.push('engaged conversation: +5');
  } else if (ctx.messageCount >= 10) {
    delta += 10;
    reasons.push('highly engaged: +10');
  }

  // Penalty for stuck conversations
  if (ctx.clarificationCount >= 3) {
    delta -= 3;
    reasons.push('stuck conversation: -3');
  }

  // Clamp delta to prevent wild swings
  delta = Math.max(-10, Math.min(15, delta));

  // Calculate new status based on projected score
  const projectedScore = Math.max(0, Math.min(100, ctx.previousScore + delta));
  const newStatus = getStatusFromScore(projectedScore);

  return {
    delta,
    reason: reasons.join(', ') || 'interaction',
    newStatus: newStatus !== getStatusFromScore(ctx.previousScore) ? newStatus : null,
  };
}

/**
 * Get lead status from score.
 */
function getStatusFromScore(score: number): 'new' | 'engaged' | 'warm' | 'hot' | 'converted' {
  if (score >= 80) return 'hot';
  if (score >= 50) return 'warm';
  if (score >= 20) return 'engaged';
  return 'new';
}

// ============================================================================
// Background Scorer
// ============================================================================

/**
 * Update lead score in background.
 * Called via ctx.waitUntil() after each message.
 */
export async function updateLeadScoreInBackground(
  db: D1Database,
  leadId: string,
  ctx: ScoringContext
): Promise<void> {
  try {
    const { delta, reason, newStatus } = calculateScoreDelta(ctx);

    if (delta === 0) {
      console.log(`📊 Lead score unchanged for ${leadId}`);
      return;
    }

    // Update score in database
    await db
      .prepare(`
        UPDATE leads
        SET score = MAX(0, MIN(100, score + ?)),
            status = CASE
              WHEN ? IS NOT NULL THEN ?
              ELSE status
            END,
            notes = COALESCE(notes, '') || ? || char(10)
        WHERE id = ?
      `)
      .bind(
        delta,
        newStatus,
        newStatus,
        `[${new Date().toISOString()}] Score ${delta >= 0 ? '+' : ''}${delta}: ${reason}`,
        leadId
      )
      .run();

    console.log(`📊 Lead ${leadId} score updated: ${delta >= 0 ? '+' : ''}${delta} (${reason})`);

    if (newStatus) {
      console.log(`🎯 Lead ${leadId} status upgraded to: ${newStatus}`);
    }
  } catch (error) {
    console.error('Failed to update lead score:', error);
  }
}
