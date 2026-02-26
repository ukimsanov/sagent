/**
 * Auto-FAQ Generator
 *
 * Extracts recurring question patterns from message_events,
 * uses LLM to group similar questions and generate FAQ entries,
 * then stores them for human review (draft status).
 */

import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { Business } from '../db/queries';

// ============================================================================
// Types
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

interface QuestionPattern {
  user_message: string;
  intent_type: string;
  count: number;
}

// ============================================================================
// Pattern Extraction
// ============================================================================

export async function getRecurringQuestionPatterns(
  db: D1Database,
  businessId: string,
  sinceTimestamp: number,
): Promise<QuestionPattern[]> {
  const result = await db.prepare(`
    SELECT user_message, intent_type, COUNT(*) as count
    FROM message_events
    WHERE business_id = ? AND timestamp >= ?
      AND user_message IS NOT NULL
      AND action IN ('answer_question', 'ask_clarification', 'show_products')
      AND intent_type IS NOT NULL
    GROUP BY intent_type, LOWER(TRIM(user_message))
    HAVING count >= 3
    ORDER BY count DESC
    LIMIT 20
  `).bind(businessId, sinceTimestamp).all<QuestionPattern>();

  return result.results || [];
}

// ============================================================================
// FAQ Generation via LLM
// ============================================================================

const FaqSchema = z.object({
  faqs: z.array(z.object({
    question: z.string().describe('Clear, concise FAQ question'),
    answer: z.string().describe('Helpful answer to the question'),
  })),
});

export async function generateFaqs(
  patterns: QuestionPattern[],
  business: Business,
  openaiApiKey: string,
  aiGatewayBaseURL?: string,
): Promise<Array<{ question: string; answer: string; sourceIntents: string[] }>> {
  if (patterns.length === 0) return [];

  const brandTone = (business as any).brand_tone || 'friendly';

  const patternsText = patterns
    .map(p => `- "${p.user_message}" (intent: ${p.intent_type}, asked ${p.count}x)`)
    .join('\n');

  const openai = createOpenAI({
    apiKey: openaiApiKey,
    ...(aiGatewayBaseURL ? { baseURL: aiGatewayBaseURL } : {}),
  });

  const { output } = await generateText({
    model: openai.responses('gpt-5-mini'),
    prompt: `Analyze these recurring customer questions for ${business.name} and generate FAQ entries.

Questions:
${patternsText}

Rules:
- Merge similar questions into single FAQ entries
- Write clear, concise answers in a ${brandTone} tone
- Max 10 FAQs
- Answers should be 1-3 sentences
- Don't make up information — if the answer isn't clear from the question, write a general helpful response`,
    output: Output.object({ schema: FaqSchema }),
    maxOutputTokens: 1000,
    temperature: 0.3,
  });

  if (!output?.faqs) return [];

  // Map intents from patterns to FAQs
  return output.faqs.map(faq => {
    const matchingIntents = patterns
      .filter(p => faq.question.toLowerCase().includes(p.user_message.toLowerCase().slice(0, 20)))
      .map(p => p.intent_type);
    return {
      question: faq.question,
      answer: faq.answer,
      sourceIntents: [...new Set(matchingIntents)],
    };
  });
}

// ============================================================================
// FAQ Storage with Deduplication
// ============================================================================

export async function storeFaqs(
  db: D1Database,
  businessId: string,
  faqs: Array<{ question: string; answer: string; sourceIntents: string[] }>,
): Promise<{ created: number; updated: number }> {
  // Get existing FAQs for dedup
  const existing = await db.prepare(
    `SELECT id, question, frequency FROM auto_faqs WHERE business_id = ? AND status != 'rejected'`,
  ).bind(businessId).all<{ id: string; question: string; frequency: number }>();

  const existingFaqs = existing.results || [];
  let created = 0;
  let updated = 0;

  for (const faq of faqs) {
    // Simple dedup: check if a similar question already exists
    const match = existingFaqs.find(ef =>
      ef.question.toLowerCase().includes(faq.question.toLowerCase().slice(0, 30)) ||
      faq.question.toLowerCase().includes(ef.question.toLowerCase().slice(0, 30)),
    );

    if (match) {
      // Update frequency
      await db.prepare(
        `UPDATE auto_faqs SET frequency = frequency + 1, updated_at = unixepoch() WHERE id = ?`,
      ).bind(match.id).run();
      updated++;
    } else {
      // Insert new
      const id = `faq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      await db.prepare(
        `INSERT INTO auto_faqs (id, business_id, question, answer, frequency, source_intents, status) VALUES (?, ?, ?, ?, 1, ?, 'draft')`,
      ).bind(id, businessId, faq.question, faq.answer, JSON.stringify(faq.sourceIntents)).run();
      created++;
    }
  }

  return { created, updated };
}

// ============================================================================
// FAQ Context Loader (for LLM injection)
// ============================================================================

export async function getApprovedFaqs(
  db: D1Database,
  businessId: string,
  limit: number = 10,
): Promise<Array<{ question: string; answer: string }>> {
  const result = await db.prepare(
    `SELECT question, answer FROM auto_faqs WHERE business_id = ? AND status = 'approved' ORDER BY frequency DESC LIMIT ?`,
  ).bind(businessId, limit).all<{ question: string; answer: string }>();

  return result.results || [];
}
