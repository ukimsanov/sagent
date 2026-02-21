/**
 * Embeddings Utility - Workers AI + Cloudflare Vectorize
 *
 * Handles semantic product search using:
 * - Workers AI EmbeddingGemma-300m for embedding generation (768 dimensions)
 * - Cloudflare Vectorize for vector storage and similarity search
 *
 * EmbeddingGemma-300m: Google model built from Gemma 3, supports 100+ languages,
 * better quality than bge-base-en-v1.5 for multilingual and semantic tasks.
 *
 * @see https://developers.cloudflare.com/workers-ai/models/embeddinggemma-300m/
 * @see https://developers.cloudflare.com/vectorize/get-started/embeddings/
 */

import type { Product } from '../db/queries';

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingResult {
  success: boolean;
  embedding?: number[];
  error?: string;
}

export interface BatchEmbeddingResult {
  success: boolean;
  embeddings?: number[][];
  error?: string;
}

export interface VectorUpsertResult {
  success: boolean;
  upsertedCount?: number;
  error?: string;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

// Workers AI embedding response shape
interface WorkersAIEmbeddingResponse {
  shape: number[];
  data: number[][];
}

// ============================================================================
// Constants
// ============================================================================

const EMBEDDING_MODEL = '@cf/google/embeddinggemma-300m';
// Note: EmbeddingGemma-300m outputs 768-dimensional vectors (same as bge-base-en-v1.5)

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embedding for a single text using Workers AI
 */
export async function generateEmbedding(
  ai: Ai,
  text: string
): Promise<EmbeddingResult> {
  try {
    const response = await ai.run(EMBEDDING_MODEL, {
      text: [text],
    }) as WorkersAIEmbeddingResponse;

    if (!response.data || response.data.length === 0) {
      return { success: false, error: 'No embedding returned from Workers AI' };
    }

    return { success: true, embedding: response.data[0] };
  } catch (error) {
    console.error('Embedding generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than calling generateEmbedding multiple times
 */
export async function generateEmbeddings(
  ai: Ai,
  texts: string[]
): Promise<BatchEmbeddingResult> {
  if (texts.length === 0) {
    return { success: true, embeddings: [] };
  }

  try {
    const response = await ai.run(EMBEDDING_MODEL, {
      text: texts,
    }) as WorkersAIEmbeddingResponse;

    if (!response.data || response.data.length !== texts.length) {
      return {
        success: false,
        error: `Expected ${texts.length} embeddings, got ${response.data?.length || 0}`,
      };
    }

    return { success: true, embeddings: response.data };
  } catch (error) {
    console.error('Batch embedding generation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Product Embedding Text Generation
// ============================================================================

/**
 * Build embedding text from product data
 * Combines name + description + category for rich semantic matching
 */
export function buildProductEmbeddingText(product: Product): string {
  const parts: string[] = [];

  // Product name is most important
  parts.push(product.name);

  // Add category for context
  if (product.category) {
    parts.push(`Category: ${product.category}`);
  }

  // Add description for detail
  if (product.description) {
    parts.push(product.description);
  }

  return parts.join('. ');
}

// ============================================================================
// Vectorize Operations
// ============================================================================

/**
 * Upsert a single product vector to Vectorize
 * Vector ID format: {business_id}:{product_id}
 */
export async function upsertProductVector(
  vectorize: VectorizeIndex,
  ai: Ai,
  product: Product
): Promise<VectorUpsertResult> {
  try {
    // Generate embedding text and create embedding
    const embeddingText = buildProductEmbeddingText(product);
    const embeddingResult = await generateEmbedding(ai, embeddingText);

    if (!embeddingResult.success || !embeddingResult.embedding) {
      return { success: false, error: embeddingResult.error };
    }

    // Upsert to Vectorize with metadata
    // Note: Vectorize metadata values cannot be null, so we convert null to 0
    const vectorId = `${product.business_id}:${product.id}`;
    await vectorize.upsert([
      {
        id: vectorId,
        values: embeddingResult.embedding,
        metadata: {
          business_id: product.business_id,
          product_id: product.id,
          name: product.name,
          category: product.category || '',
          price: product.price ?? 0,
          in_stock: product.in_stock,
        },
      },
    ]);

    console.log(`Embedded product: ${product.name} (${vectorId})`);
    return { success: true, upsertedCount: 1 };
  } catch (error) {
    console.error(`Failed to embed product ${product.id}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch upsert multiple product vectors to Vectorize
 * More efficient for bulk operations
 */
export async function upsertProductVectorsBatch(
  vectorize: VectorizeIndex,
  ai: Ai,
  products: Product[]
): Promise<VectorUpsertResult> {
  if (products.length === 0) {
    return { success: true, upsertedCount: 0 };
  }

  try {
    // Generate embedding texts
    const texts = products.map(buildProductEmbeddingText);

    // Batch generate embeddings
    const embeddingResult = await generateEmbeddings(ai, texts);
    if (!embeddingResult.success || !embeddingResult.embeddings) {
      return { success: false, error: embeddingResult.error };
    }

    // Build vectors with metadata
    // Note: Vectorize metadata values cannot be null, so we convert null to 0
    const vectors: VectorizeVector[] = products.map((product, index) => ({
      id: `${product.business_id}:${product.id}`,
      values: embeddingResult.embeddings![index],
      metadata: {
        business_id: product.business_id,
        product_id: product.id,
        name: product.name,
        category: product.category || '',
        price: product.price ?? 0,
        in_stock: product.in_stock,
      },
    }));

    // Upsert all vectors
    await vectorize.upsert(vectors);

    console.log(`Embedded ${products.length} products in batch`);
    return { success: true, upsertedCount: products.length };
  } catch (error) {
    console.error('Batch product embedding failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a product vector from Vectorize
 * Called when product is deleted from catalog
 */
export async function deleteProductVector(
  vectorize: VectorizeIndex,
  businessId: string,
  productId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const vectorId = `${businessId}:${productId}`;
    await vectorize.deleteByIds([vectorId]);
    console.log(`Deleted product vector: ${vectorId}`);
    return { success: true };
  } catch (error) {
    console.error(`Failed to delete product vector ${productId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Semantic Search
// ============================================================================

/**
 * Search for products semantically using natural language query
 * Returns product IDs ranked by similarity score
 *
 * Note: If metadata filter isn't working (index not ready), falls back
 * to unfiltered query and filters results by business_id
 */
export async function searchProductsVectorize(
  vectorize: VectorizeIndex,
  ai: Ai,
  businessId: string,
  query: string,
  topK: number = 10
): Promise<{ success: boolean; results?: VectorSearchResult[]; error?: string }> {
  try {
    // Generate query embedding
    const embeddingResult = await generateEmbedding(ai, query);
    if (!embeddingResult.success || !embeddingResult.embedding) {
      return { success: false, error: embeddingResult.error };
    }

    let matches;
    try {
      // Try filtered query first (more efficient when metadata index is ready)
      matches = await vectorize.query(embeddingResult.embedding, {
        topK,
        filter: { business_id: businessId },
        returnMetadata: 'all',
      });
    } catch (filterError) {
      // Fallback: query without filter, then filter results manually
      console.warn('Filtered query failed, using fallback:', filterError);
      const unfilteredMatches = await vectorize.query(embeddingResult.embedding, {
        topK: topK * 3, // Get more results to filter
        returnMetadata: 'all',
      });
      matches = {
        ...unfilteredMatches,
        matches: unfilteredMatches.matches
          .filter((m) => m.metadata?.business_id === businessId)
          .slice(0, topK),
      };
    }

    // Transform results
    const results: VectorSearchResult[] = matches.matches.map((match) => ({
      id: (match.metadata?.product_id as string) || match.id.split(':')[1],
      score: match.score,
      metadata: match.metadata as Record<string, unknown> | undefined,
    }));

    console.log(`Semantic search for "${query}": ${results.length} results`);
    return { success: true, results };
  } catch (error) {
    console.error('Semantic search failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if Vectorize index has any vectors for a business
 * Uses unfiltered query and checks metadata manually
 * (metadata filters require index to be ready)
 */
export async function hasProductVectors(
  vectorize: VectorizeIndex,
  ai: Ai,
  businessId: string
): Promise<boolean> {
  try {
    // Query with a generic term to see if any vectors exist
    const embeddingResult = await generateEmbedding(ai, 'product');
    if (!embeddingResult.success || !embeddingResult.embedding) {
      return false;
    }

    // Query without filter and check metadata manually
    const matches = await vectorize.query(embeddingResult.embedding, {
      topK: 20,
      returnMetadata: 'all',
    });

    // Check if any match belongs to this business
    return matches.matches.some(
      (m) => m.metadata?.business_id === businessId
    );
  } catch (error) {
    console.error('hasProductVectors error:', error);
    return false;
  }
}
