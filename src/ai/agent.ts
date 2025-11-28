/**
 * AI Agent - Orchestrates LLM calls and tool execution
 *
 * Uses OpenAI Responses API with GPT-5-nano
 * https://platform.openai.com/docs/api-reference/responses
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

// Responses API types
interface ResponsesAPIInput {
  role: 'user' | 'assistant';
  content: string;
}

interface FunctionCallItem {
  type: 'function_call';
  id: string;
  call_id: string;
  name: string;
  arguments: string;
}

interface MessageItem {
  type: 'message';
  id: string;
  role: 'assistant';
  content: Array<{
    type: 'output_text';
    text: string;
  }>;
}

interface ReasoningItem {
  type: 'reasoning';
  id: string;
  content: unknown[];
}

type OutputItem = FunctionCallItem | MessageItem | ReasoningItem | { type: string };

interface ResponsesAPIResponse {
  id: string;
  object: 'response';
  output: OutputItem[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
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
  const instructions = buildSystemPrompt(business, lead, conversationSummary);

  // Build input array for Responses API
  const input: ResponsesAPIInput[] = [
    ...conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    { role: 'user' as const, content: userMessage }
  ];

  // Track what happened during this agent run
  const toolsCalled: string[] = [];
  let leadScoreChange = 0;
  let flaggedForHuman = false;

  // Call OpenAI Responses API
  let response = await callResponsesAPI(openaiApiKey, instructions, input, AGENT_TOOLS);

  // Handle tool calls in a loop (the API is agentic but we may need to provide results)
  const maxIterations = 5;
  let iterations = 0;

  // Collect all items for context
  let allItems: OutputItem[] = [...response.output];

  while (iterations < maxIterations) {
    iterations++;

    // Find function calls in the output
    const functionCalls = response.output.filter(
      (item): item is FunctionCallItem => item.type === 'function_call'
    );

    if (functionCalls.length === 0) {
      break; // No more tool calls, we're done
    }

    // Execute each function call and collect results
    const functionResults: Array<{ type: 'function_call_output'; call_id: string; output: string }> = [];

    for (const funcCall of functionCalls) {
      const toolName = funcCall.name;
      const toolArgs = JSON.parse(funcCall.arguments);

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

      functionResults.push({
        type: 'function_call_output',
        call_id: funcCall.call_id,
        output: JSON.stringify(toolResult)
      });
    }

    // Call API again with function results
    response = await callResponsesAPIWithResults(
      openaiApiKey,
      instructions,
      input,
      AGENT_TOOLS,
      allItems,
      functionResults
    );

    allItems = [...allItems, ...functionResults, ...response.output];
  }

  // Extract the final text response from message items
  const messageItems = response.output.filter(
    (item): item is MessageItem => item.type === 'message'
  );

  let finalMessage = "I'm sorry, I couldn't process that request.";

  if (messageItems.length > 0) {
    const lastMessage = messageItems[messageItems.length - 1];
    const textContent = lastMessage.content.find(c => c.type === 'output_text');
    if (textContent) {
      finalMessage = textContent.text;
    }
  }

  return {
    message: finalMessage,
    toolsCalled,
    leadScoreChange,
    flaggedForHuman
  };
}

// ============================================================================
// OpenAI Responses API Call
// ============================================================================

async function callResponsesAPI(
  apiKey: string,
  instructions: string,
  input: ResponsesAPIInput[],
  tools: typeof AGENT_TOOLS
): Promise<ResponsesAPIResponse> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      instructions,
      input,
      tools: tools.map(tool => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      })),
      max_output_tokens: 2000,
      reasoning: {
        effort: 'low'
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const result = await response.json() as ResponsesAPIResponse;
  console.log('OpenAI response:', JSON.stringify(result, null, 2));
  return result;
}

async function callResponsesAPIWithResults(
  apiKey: string,
  instructions: string,
  originalInput: ResponsesAPIInput[],
  tools: typeof AGENT_TOOLS,
  previousOutput: OutputItem[],
  functionResults: Array<{ type: 'function_call_output'; call_id: string; output: string }>
): Promise<ResponsesAPIResponse> {
  // Build input with previous context and function results
  const input = [
    ...originalInput,
    ...previousOutput,
    ...functionResults
  ];

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      instructions,
      input,
      tools: tools.map(tool => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      })),
      max_output_tokens: 2000,
      reasoning: {
        effort: 'low'
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const result = await response.json() as ResponsesAPIResponse;
  console.log('OpenAI response with results:', JSON.stringify(result, null, 2));
  return result;
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
