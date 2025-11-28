/**
 * AI Agent - Orchestrates LLM calls and tool execution
 *
 * Uses OpenAI Responses API with GPT-4o-mini
 * https://platform.openai.com/docs/guides/function-calling
 */

import { AGENT_TOOLS } from './tools';
import { buildSystemPrompt } from './prompts';
import type { Business, Lead, ConversationSummary, ProductWithMetadata } from '../db/queries';
import * as db from '../db/queries';

// ============================================================================
// Types
// ============================================================================

interface AgentContext {
  business: Business;
  lead: Lead;
  conversationSummary: ConversationSummary | null;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface AgentResponse {
  message: string;
  toolsCalled: string[];
  leadScoreChange: number;
  flaggedForHuman: boolean;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIResponse {
  id: string;
  choices: Array<{
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// Main Agent Function
// ============================================================================

export async function runAgent(
  openaiApiKey: string,
  database: D1Database,
  context: AgentContext,
  userMessage: string
): Promise<AgentResponse> {
  const { business, lead, conversationSummary, conversationHistory } = context;

  // Build the system prompt with all context
  const systemPrompt = buildSystemPrompt(business, lead, conversationSummary);

  // Build messages array for OpenAI
  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];

  // Track what happened during this agent run
  const toolsCalled: string[] = [];
  let leadScoreChange = 0;
  let flaggedForHuman = false;

  // Call OpenAI with tools
  let response = await callOpenAI(openaiApiKey, messages, AGENT_TOOLS);
  let assistantMessage = response.choices[0].message;

  // Handle tool calls in a loop (model might call multiple tools)
  const maxIterations = 5; // Prevent infinite loops
  let iterations = 0;

  while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
    iterations++;

    // Add assistant's tool call message to history
    messages.push({
      role: 'assistant',
      content: assistantMessage.content || ''
    });

    // Execute each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      toolsCalled.push(toolName);

      // Execute the tool
      const toolResult = await executeToolCall(
        database,
        business.id,
        lead.id,
        toolName,
        toolArgs
      );

      // Track lead score changes and human flags
      if (toolName === 'update_lead_score') {
        leadScoreChange += toolArgs.score_change || 0;
      }
      if (toolName === 'flag_for_human') {
        flaggedForHuman = true;
      }

      // Add tool result to messages
      // Note: OpenAI Chat Completions API expects tool results in a specific format
      messages.push({
        role: 'assistant', // This is a simplification - proper format would use 'tool' role
        content: `[Tool: ${toolName}]\n${JSON.stringify(toolResult)}`
      });
    }

    // Call OpenAI again with tool results
    response = await callOpenAI(openaiApiKey, messages, AGENT_TOOLS);
    assistantMessage = response.choices[0].message;
  }

  // Extract the final text response
  const finalMessage = assistantMessage.content || "I'm sorry, I couldn't process that request.";

  return {
    message: finalMessage,
    toolsCalled,
    leadScoreChange,
    flaggedForHuman
  };
}

// ============================================================================
// OpenAI API Call
// ============================================================================

async function callOpenAI(
  apiKey: string,
  messages: OpenAIMessage[],
  tools: typeof AGENT_TOOLS
): Promise<OpenAIResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      tools: tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          strict: tool.strict
        }
      })),
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Tool Execution
// ============================================================================

async function executeToolCall(
  database: D1Database,
  businessId: string,
  leadId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'search_products': {
      const products = await db.searchProducts(
        database,
        businessId,
        args.query as string,
        args.category as string | undefined
      );
      return {
        products: products.map(formatProductForLLM),
        total: products.length,
        message: products.length > 0
          ? `Found ${products.length} product(s)`
          : 'No products found matching that search'
      };
    }

    case 'get_product_details': {
      const product = await db.getProductById(database, args.product_id as string);
      if (!product) {
        return { error: 'Product not found', product_id: args.product_id };
      }
      return formatProductDetailsForLLM(product);
    }

    case 'check_availability': {
      const result = await db.checkProductAvailability(
        database,
        args.product_id as string,
        (args.quantity as number) || 1
      );
      return {
        product_id: args.product_id,
        product_name: result.product?.name || 'Unknown',
        available: result.available,
        stock_quantity: result.stock,
        requested_quantity: (args.quantity as number) || 1,
        message: result.available
          ? `Yes, ${result.product?.name} is in stock`
          : result.product
            ? `Sorry, ${result.product.name} is currently out of stock`
            : 'Product not found'
      };
    }

    case 'get_categories': {
      const categories = await db.getAllCategories(database, businessId);
      return {
        categories,
        message: `Available categories: ${categories.join(', ')}`
      };
    }

    case 'update_lead_score': {
      await db.updateLeadScore(
        database,
        leadId,
        args.score_change as number,
        args.reason as string
      );
      return {
        success: true,
        score_change: args.score_change,
        reason: args.reason
      };
    }

    case 'flag_for_human': {
      await db.createHumanFlag(
        database,
        leadId,
        args.urgency as 'low' | 'medium' | 'high',
        args.reason as string
      );
      return {
        success: true,
        message: 'Conversation flagged for human follow-up',
        urgency: args.urgency,
        reason: args.reason
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatProductForLLM(product: ProductWithMetadata): Record<string, unknown> {
  return {
    id: product.id,
    name: product.name,
    price: product.price ? `$${product.price.toFixed(2)}` : 'Price not set',
    category: product.category,
    in_stock: product.in_stock === 1,
    description: product.description?.substring(0, 100) // Keep it short for list view
  };
}

function formatProductDetailsForLLM(product: ProductWithMetadata): Record<string, unknown> {
  const details: Record<string, unknown> = {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price ? `$${product.price.toFixed(2)}` : 'Price not set',
    currency: product.currency,
    category: product.category,
    in_stock: product.in_stock === 1,
    stock_quantity: product.stock_quantity
  };

  // Add metadata fields (sizes, colors, etc.)
  if (product.metadata) {
    const meta = product.metadata as Record<string, unknown>;
    if (meta.sizes) details.available_sizes = meta.sizes;
    if (meta.colors) details.available_colors = meta.colors;
    if (meta.material) details.material = meta.material;
    if (meta.note) details.note = meta.note;
  }

  return details;
}
