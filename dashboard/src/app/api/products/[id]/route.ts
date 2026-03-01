import { NextRequest, NextResponse } from "next/server";
import { getDB, getProductById, updateProduct, deleteProduct, toggleProductStock, saveProductVariants } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { triggerEmbeddingsBackground } from "@/lib/worker-proxy";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/products/[id]
 * Get a single product
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    const product = await getProductById(db, id);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Verify the product belongs to the user's business
    if (product.business_id !== businessId) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("Product get error:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products/[id]
 * Update a product
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    // Verify the product exists and belongs to the user's business
    const existingProduct = await getProductById(db, id);
    if (!existingProduct || existingProduct.business_id !== businessId) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    interface VariantInput {
      size?: string | null;
      color?: string | null;
      sku?: string | null;
      stock_quantity?: number;
      price_override?: number | null;
    }

    interface ProductUpdateBody {
      name?: string;
      description?: string | null;
      price?: number | string | null;
      currency?: string;
      category?: string | null;
      in_stock?: boolean | number;
      stock_quantity?: number | string | null;
      metadata?: Record<string, unknown> | null;
      image_urls?: string[];
      variants?: VariantInput[];
    }

    const body = await request.json() as ProductUpdateBody;

    // Build updates object
    const updates: {
      name?: string;
      description?: string | null;
      price?: number | null;
      currency?: string;
      category?: string | null;
      in_stock?: number;
      stock_quantity?: number | null;
      metadata?: string | null;
      image_urls?: string[];
    } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim() === "") {
        return NextResponse.json(
          { error: "Product name cannot be empty" },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description || null;
    }

    if (body.price !== undefined) {
      updates.price = body.price !== null ? Number(body.price) : null;
    }

    if (body.currency !== undefined) {
      updates.currency = body.currency;
    }

    if (body.category !== undefined) {
      updates.category = body.category || null;
    }

    if (body.in_stock !== undefined) {
      updates.in_stock = body.in_stock ? 1 : 0;
    }

    if (body.stock_quantity !== undefined) {
      updates.stock_quantity = body.stock_quantity !== null ? Number(body.stock_quantity) : null;
    }

    if (body.metadata !== undefined) {
      updates.metadata = body.metadata ? JSON.stringify(body.metadata) : null;
    }

    if (body.image_urls !== undefined) {
      updates.image_urls = body.image_urls;
    }

    await updateProduct(db, id, updates);

    // Save variants if provided
    if (body.variants !== undefined) {
      await saveProductVariants(db, id, body.variants);
    }

    // Fetch and return the updated product
    const updatedProduct = await getProductById(db, id);

    // Trigger embedding regeneration in background (non-blocking)
    triggerEmbeddingsBackground(businessId);

    return NextResponse.json({ product: updatedProduct });
  } catch (error) {
    console.error("Product update error:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/[id]
 * Delete a product
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    // Verify the product exists and belongs to the user's business
    const existingProduct = await getProductById(db, id);
    if (!existingProduct || existingProduct.business_id !== businessId) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await deleteProduct(db, id);

    // Trigger embedding regeneration in background (non-blocking)
    triggerEmbeddingsBackground(businessId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Product delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/products/[id]
 * Quick stock toggle
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    // Verify the product exists and belongs to the user's business
    const existingProduct = await getProductById(db, id);
    if (!existingProduct || existingProduct.business_id !== businessId) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json() as { in_stock?: number | boolean };

    if (body.in_stock !== undefined) {
      await toggleProductStock(db, id, Boolean(body.in_stock));
    }

    // Fetch and return the updated product
    const updatedProduct = await getProductById(db, id);

    return NextResponse.json({ product: updatedProduct });
  } catch (error) {
    console.error("Product patch error:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}
