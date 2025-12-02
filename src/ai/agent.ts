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
import { sendImageMessage } from '../whatsapp/messages';

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
  responseId: string; // OpenAI response ID for conversation chaining
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
    input_tokens_details?: {
      cached_tokens: number;
    };
  };
}

// ============================================================================
// Main Agent Function
// ============================================================================

export async function runAgent(
  openaiApiKey: string,
  database: D1Database,
  context: AgentContext,
  userMessage: string,
  options?: {
    previousResponseId?: string;
    promptCacheKey?: string;
    whatsappConfig?: {
      phoneNumberId: string;
      accessToken: string;
      recipientNumber: string;
    };
  }
): Promise<AgentResponse> {
  const { business, lead, conversationSummary, conversationHistory } = context;

  // Build the system prompt with all context
  const instructions = buildSystemPrompt(business, lead, conversationSummary, conversationHistory);

  // Build input array for Responses API
  // If we have a previous_response_id, OpenAI already has the conversation context
  // so we only need to send the new user message (saves tokens!)
  let input: ResponsesAPIInput[];
  if (options?.previousResponseId) {
    // Only send new message - OpenAI has the rest
    input = [{ role: 'user' as const, content: userMessage }];
    console.log('Using previous_response_id - sending only new message');
  } else {
    // First message or no stored response - send full history
    input = [
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user' as const, content: userMessage }
    ];
    console.log('No previous_response_id - sending full conversation history');
  }

  // Track what happened during this agent run
  const toolsCalled: string[] = [];
  let leadScoreChange = 0;
  let flaggedForHuman = false;

  // Call OpenAI Responses API with caching options
  let response: ResponsesAPIResponse;

  try {
    response = await callResponsesAPI(openaiApiKey, instructions, input, AGENT_TOOLS, {
      previousResponseId: options?.previousResponseId,
      promptCacheKey: options?.promptCacheKey
    });
  } catch (error) {
    // If using previous_response_id fails (e.g., incomplete tool calls from previous session),
    // fall back to sending full conversation history without it
    if (options?.previousResponseId && error instanceof Error &&
        (error.message.includes('tool output') || error.message.includes('400'))) {
      console.log('previous_response_id failed, falling back to full history');

      // Rebuild input with full conversation history
      input = [
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        { role: 'user' as const, content: userMessage }
      ];

      response = await callResponsesAPI(openaiApiKey, instructions, input, AGENT_TOOLS, {
        promptCacheKey: options?.promptCacheKey
        // No previousResponseId - start fresh
      });
    } else {
      throw error; // Re-throw if it's a different error
    }
  }

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

      // Log tool execution for debugging
      console.log(`🔧 Tool Called: ${toolName}`, toolArgs);

      // Execute the tool
      const toolResult = await executeToolCall(
        database,
        business.id,
        lead.id,
        toolName,
        toolArgs,
        options?.whatsappConfig
      );

      // Log search results specifically
      if (toolName === 'search_products') {
        const result = toolResult as any;
        console.log(`🔍 Search Result: Found ${result.total || 0} products for "${toolArgs.query}"`);
        if (result.total === 0) {
          console.log('⚠️  EMPTY SEARCH - AI should NOT suggest alternatives without searching');
        }
      }

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

  // Check if we hit max iterations without getting a final message
  if (iterations >= maxIterations) {
    console.log(`Hit max iterations (${maxIterations}) - forcing final response without tools`);
  }

  // Extract the final text response from message items
  let messageItems = response.output.filter(
    (item): item is MessageItem => item.type === 'message'
  );

  // If no message found (model stuck in tool loop), make one more call without tools
  if (messageItems.length === 0) {
    console.log('No message in response - making final call without tools');
    // Don't pass allItems (tool call history) - just ask for a direct response
    // Add a system nudge to respond based on what was learned
    const nudgedInput = [
      ...input,
      { role: 'user' as const, content: '[System: Please respond to the customer based on the product searches you performed. Do not call any more tools.]' }
    ];
    response = await callResponsesAPI(
      openaiApiKey,
      instructions + '\n\nIMPORTANT: Respond NOW with a text message. Do not call any tools.',
      nudgedInput,
      [], // No tools - force text response
      {}
    );
    messageItems = response.output.filter(
      (item): item is MessageItem => item.type === 'message'
    );
  }

  let finalMessage = "I'm sorry, I couldn't process that request.";

  if (messageItems.length > 0) {
    const lastMessage = messageItems[messageItems.length - 1];
    const textContent = lastMessage.content.find(c => c.type === 'output_text');
    if (textContent) {
      finalMessage = textContent.text;
    }
  }

  // Log final response for debugging
  console.log('💬 AI Response:', {
    messagePreview: finalMessage.substring(0, 150) + (finalMessage.length > 150 ? '...' : ''),
    toolsCalled,
    leadScoreChange,
    flaggedForHuman,
    responseId: response.id
  });

  return {
    message: finalMessage,
    toolsCalled,
    leadScoreChange,
    flaggedForHuman,
    responseId: response.id
  };
}

// ============================================================================
// OpenAI Responses API Call
// ============================================================================

async function callResponsesAPI(
  apiKey: string,
  instructions: string,
  input: ResponsesAPIInput[],
  tools: typeof AGENT_TOOLS | readonly [],
  options?: {
    previousResponseId?: string;
    promptCacheKey?: string;
  }
): Promise<ResponsesAPIResponse> {
  // Build request body with optional caching parameters
  const requestBody: Record<string, unknown> = {
    model: 'gpt-5-nano',
    instructions,
    input,
    max_output_tokens: 2000,
    reasoning: {
      effort: 'low'
    }
  };

  // Only add tools if there are any (allows forcing text-only response)
  if (tools.length > 0) {
    requestBody.tools = tools.map(tool => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  // Add previous_response_id for conversation chaining (reduces token usage)
  if (options?.previousResponseId) {
    requestBody.previous_response_id = options.previousResponseId;
  }

  // Add prompt_cache_key for better cache hit rates
  if (options?.promptCacheKey) {
    requestBody.prompt_cache_key = options.promptCacheKey;
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const result = await response.json() as ResponsesAPIResponse;

  // Log usage with cache info
  if (result.usage) {
    const cached = result.usage.input_tokens_details?.cached_tokens || 0;
    const inputTokens = result.usage.input_tokens;
    const cacheHitRate = inputTokens > 0 ? ((cached / inputTokens) * 100).toFixed(1) : '0';
    console.log(`OpenAI usage: ${inputTokens} input (${cached} cached, ${cacheHitRate}% hit rate), ${result.usage.output_tokens} output`);
  }

  console.log('OpenAI response id:', result.id);
  return result;
}

async function callResponsesAPIWithResults(
  apiKey: string,
  instructions: string,
  originalInput: ResponsesAPIInput[],
  tools: typeof AGENT_TOOLS | readonly [],
  previousOutput: OutputItem[],
  functionResults: Array<{ type: 'function_call_output'; call_id: string; output: string }>
): Promise<ResponsesAPIResponse> {
  // Build input with previous context and function results
  const input = [
    ...originalInput,
    ...previousOutput,
    ...functionResults
  ];

  // Build request body - only include tools if there are any
  const requestBody: Record<string, unknown> = {
    model: 'gpt-5-nano',
    instructions,
    input,
    max_output_tokens: 2000,
    reasoning: {
      effort: 'low'
    }
  };

  // Only add tools if there are any (allows forcing text-only response)
  if (tools.length > 0) {
    requestBody.tools = tools.map(tool => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const result = await response.json() as ResponsesAPIResponse;
  // Only log summary info, not the full response (which includes huge instructions)
  console.log('OpenAI response id:', result.id, '| output types:', result.output.map(o => o.type).join(', '));
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
  args: Record<string, unknown>,
  whatsappConfig?: {
    phoneNumberId: string;
    accessToken: string;
    recipientNumber: string;
  }
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

    // ========================================================================
    // Phase 2: Goal-Based Tools
    // ========================================================================

    case 'capture_lead_info': {
      const info: {
        name?: string;
        email?: string;
        preferred_contact?: 'whatsapp' | 'phone' | 'email';
      } = {};

      if (args.name) info.name = args.name as string;
      if (args.email) info.email = args.email as string;
      if (args.preferred_contact) {
        info.preferred_contact = args.preferred_contact as 'whatsapp' | 'phone' | 'email';
      }

      await db.updateLeadInfo(database, leadId, info);

      return {
        success: true,
        message: 'Lead information saved',
        captured: info
      };
    }

    case 'request_callback': {
      const result = await db.createCallbackRequest(
        database,
        leadId,
        businessId,
        args.preferred_time as string | null,
        args.reason as string | null
      );

      return {
        success: true,
        message: 'Callback request created',
        request_id: result.id
      };
    }

    case 'book_appointment': {
      const appointment = await db.createAppointment(
        database,
        leadId,
        businessId,
        args.date as string | null,
        args.time as string | null,
        args.notes as string | null
      );

      return {
        success: true,
        message: 'Appointment booked',
        appointment_id: appointment.id,
        date: appointment.requested_date,
        time: appointment.requested_time
      };
    }

    case 'send_promo_code': {
      const promo = await db.getUnusedPromoCode(database, businessId);

      if (!promo) {
        return {
          success: false,
          message: 'No promo codes available at the moment'
        };
      }

      // Mark as used
      await db.markPromoCodeUsed(database, promo.id, leadId);

      const discount = promo.discount_percent
        ? `${promo.discount_percent}% off`
        : promo.discount_amount
          ? `$${promo.discount_amount} off`
          : 'discount';

      return {
        success: true,
        message: `Promo code sent: ${promo.code}`,
        code: promo.code,
        discount
      };
    }

    case 'send_product_image': {
      console.log(`[send_product_image] Attempting to send image for product: ${args.product_id}`);
      const product = await db.getProductById(database, args.product_id as string);

      if (!product) {
        console.log('[send_product_image] Product not found');
        return {
          success: false,
          message: 'Product not found'
        };
      }

      console.log(`[send_product_image] Product found: ${product.name}, images: ${product.image_urls.length}`);

      if (product.image_urls.length === 0) {
        console.log('[send_product_image] No images available');
        return {
          success: false,
          message: 'No images available for this product'
        };
      }

      // Send image(s) via WhatsApp if config is available
      if (whatsappConfig) {
        console.log(`[send_product_image] WhatsApp config available, sending ${product.image_urls.length} images`);
        try {
          // Send all images
          for (let i = 0; i < product.image_urls.length; i++) {
            const imageUrl = product.image_urls[i];
            console.log(`[send_product_image] Sending image ${i + 1}/${product.image_urls.length}: ${imageUrl}`);
            // Only add caption to first image
            const caption = i === 0
              ? `${product.name}${product.price ? ` - $${product.price}` : ''}`
              : undefined;

            await sendImageMessage(
              whatsappConfig.phoneNumberId,
              whatsappConfig.accessToken,
              whatsappConfig.recipientNumber,
              imageUrl,
              caption
            );
            console.log(`[send_product_image] Image ${i + 1} sent successfully`);
          }

          const imageCount = product.image_urls.length;
          console.log(`[send_product_image] All ${imageCount} images sent successfully`);
          return {
            success: true,
            message: `${imageCount} image${imageCount > 1 ? 's' : ''} sent for ${product.name}`,
            image_sent: true
          };
        } catch (error) {
          console.error('[send_product_image] Failed to send images:', error);
          return {
            success: false,
            message: 'Failed to send images'
          };
        }
      }

      console.log('[send_product_image] WhatsApp config not available');
      return {
        success: false,
        message: 'Cannot send images - WhatsApp not configured'
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
