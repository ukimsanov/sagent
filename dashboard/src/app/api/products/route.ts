import { NextRequest, NextResponse } from "next/server";
import { getDB, getProducts, createProduct, getCategories } from "@/lib/db";
import { getUserBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

/**
 * GET /api/products
 * List products with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const businessId = await getUserBusinessId(db, user.id);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const inStockParam = searchParams.get("inStock");
    const inStock = inStockParam === "true" ? true : inStockParam === "false" ? false : undefined;

    const { products, total } = await getProducts(db, businessId, {
      limit,
      offset,
      search,
      category,
      inStock,
    });

    // Also fetch categories for filter dropdown
    const categories = await getCategories(db, businessId);

    return NextResponse.json({
      products,
      total,
      categories,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Products list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 * Create a new product
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const businessId = await getUserBusinessId(db, user.id);

    const body = await request.json() as {
      name?: string;
      description?: string;
      price?: number | string;
      currency?: string;
      category?: string;
      in_stock?: boolean | number;
      stock_quantity?: number | string;
      metadata?: Record<string, unknown>;
      image_urls?: string[];
    };

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const product = await createProduct(db, {
      business_id: businessId,
      name: body.name.trim(),
      description: body.description || null,
      price: body.price !== undefined ? Number(body.price) : null,
      currency: body.currency || "USD",
      category: body.category || null,
      in_stock: body.in_stock !== undefined ? (body.in_stock ? 1 : 0) : 1,
      stock_quantity: body.stock_quantity !== undefined ? Number(body.stock_quantity) : null,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      image_urls: body.image_urls || [],
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Product create error:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
