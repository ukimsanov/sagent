/**
 * LLM Decision Engine - Structured Output via Vercel AI SDK
 *
 * Uses AI SDK with OpenAI Responses API for provider-agnostic structured output.
 * The LLM is the decision engine; code validates and executes.
 *
 * Benefits over raw fetch:
 * - Zod schema = single source of truth for types + validation
 * - Provider switching is one-line (swap openai for anthropic)
 * - Built-in retry, timeout, error handling
 * - No manual response parsing
 */

import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// ============================================================================
// Zod Schema (single source of truth for types + JSON Schema)
// ============================================================================

const ConversationActionSchema = z.enum([
  'show_products',
  'ask_clarification',
  'answer_question',
  'greet',
  'thank',
  'empathize',
  'handoff',
  'farewell',
]);

const BusinessActionTypeSchema = z.enum([
  // Tier 0 - Always safe
  'flag_for_human',
  'log_interest',
  'update_lead_status',
  'create_support_ticket',
  'resend_tracking',
  // Tier 1 - Policy-gated
  'issue_small_refund',
  'apply_discount_code',
  'cancel_order',
]);

const BusinessActionSchema = z.object({
  type: BusinessActionTypeSchema,
  order_id: z.string().nullable(),
  amount: z.number().nullable(),
  reason: z.string().nullable(),
  status: z.string().nullable(),
  interest: z.string().nullable(),
  discount_code: z.string().nullable(),
});

const LLMDecisionSchema = z.object({
  conversation_action: ConversationActionSchema,
  business_actions: z.array(BusinessActionSchema),
  message: z.string(),
  product_ids: z.array(z.string()).nullable(),
  send_images: z.boolean().nullable(),
  reasoning: z.string().nullable(),
});

// ============================================================================
// Exported Types (inferred from Zod — single source of truth)
// ============================================================================

export type ConversationAction = z.infer<typeof ConversationActionSchema>;
export type BusinessActionType = z.infer<typeof BusinessActionTypeSchema>;
export type BusinessAction = z.infer<typeof BusinessActionSchema>;
export type LLMDecision = z.infer<typeof LLMDecisionSchema>;

// ============================================================================
// Main LLM Function
// ============================================================================

/**
 * Call LLM with structured output to get a decision.
 *
 * @param systemPrompt - Instructions and guardrails for the LLM
 * @param environmentJson - JSON string of environment snapshot
 * @param apiKey - OpenAI API key
 * @param timeoutMs - Timeout in milliseconds (default 60s)
 * @returns LLMDecision or null if failed
 */
export async function callLLMForDecision(
  systemPrompt: string,
  environmentJson: string,
  apiKey: string,
  timeoutMs: number = 60_000,
  gatewayBaseURL?: string
): Promise<LLMDecision | null> {
  const startTime = Date.now();

  try {
    console.log('Calling LLM for decision (gpt-5-mini via AI SDK)...');

    const openai = createOpenAI({
      apiKey,
      ...(gatewayBaseURL ? { baseURL: gatewayBaseURL } : {}),
    });

    const { output, usage } = await generateText({
      model: openai.responses('gpt-5-mini'),
      system: systemPrompt,
      prompt: `ENVIRONMENT_SNAPSHOT:\n${environmentJson}`,
      output: Output.object({ schema: LLMDecisionSchema }),
      maxOutputTokens: 1024,
      providerOptions: {
        openai: {
          reasoningEffort: 'low',
        },
      },
      abortSignal: AbortSignal.timeout(timeoutMs),
    });

    const duration = Date.now() - startTime;
    console.log(`LLM call completed in ${duration}ms (tokens: ${usage?.totalTokens ?? 'unknown'})`);

    if (!output) {
      console.warn('LLM returned no structured output');
      return null;
    }

    console.log('LLM decision:', output.conversation_action, '-', output.message.substring(0, 50) + '...');
    return output;

  } catch (err) {
    const duration = Date.now() - startTime;

    if (err instanceof Error) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        console.error(`LLM call timed out after ${duration}ms`);
        return null;
      }

      // AI SDK wraps API errors with useful context
      console.error(`LLM call failed after ${duration}ms:`, err.message);
    } else {
      console.error(`LLM call failed after ${duration}ms:`, err);
    }

    return null;
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a decision is valid and safe to execute.
 */
export function isValidDecision(decision: LLMDecision): boolean {
  // Zod already validated the schema, so we only check business logic
  if (!decision.message || decision.message.trim().length === 0) {
    return false;
  }
  return true;
}

/**
 * Get Tier 2 actions that should force handoff.
 */
export function getTier2Actions(decision: LLMDecision): BusinessAction[] {
  const tier2Types: BusinessActionType[] = [
    'issue_small_refund',
    'apply_discount_code',
    'cancel_order',
  ];

  return decision.business_actions.filter(action =>
    tier2Types.includes(action.type)
  );
}
