import { NextRequest, NextResponse } from "next/server";
import { getDB, getProductById, updateProduct, deleteProduct, toggleProductStock } from "@/lib/db";
import { getUserBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

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
    const businessId = await getUserBusinessId(db, user.id);

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
    const businessId = await getUserBusinessId(db, user.id);

    // Verify the product exists and belongs to the user's business
    const existingProduct = await getProductById(db, id);
    if (!existingProduct || existingProduct.business_id !== businessId) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();

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
      updates.price = body.price !== null ? parseFloat(body.price) : null;
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
      updates.stock_quantity = body.stock_quantity !== null ? parseInt(body.stock_quantity, 10) : null;
    }

    if (body.metadata !== undefined) {
      updates.metadata = body.metadata ? JSON.stringify(body.metadata) : null;
    }

    if (body.image_urls !== undefined) {
      updates.image_urls = body.image_urls;
    }

    await updateProduct(db, id, updates);

    // Fetch and return the updated product
    const updatedProduct = await getProductById(db, id);

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
    const businessId = await getUserBusinessId(db, user.id);

    // Verify the product exists and belongs to the user's business
    const existingProduct = await getProductById(db, id);
    if (!existingProduct || existingProduct.business_id !== businessId) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await deleteProduct(db, id);

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
    const businessId = await getUserBusinessId(db, user.id);

    // Verify the product exists and belongs to the user's business
    const existingProduct = await getProductById(db, id);
    if (!existingProduct || existingProduct.business_id !== businessId) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();

    if (body.in_stock !== undefined) {
      await toggleProductStock(db, id, body.in_stock);
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
