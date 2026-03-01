import { NextRequest, NextResponse } from "next/server";
import { getDB, createProduct, saveProductVariants } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { triggerEmbeddingsBackground } from "@/lib/worker-proxy";
import Papa from "papaparse";

interface ImportRow {
  name?: string;
  description?: string;
  price?: string;
  currency?: string;
  category?: string;
  in_stock?: string;
  size?: string;
  color?: string;
  sku?: string;
  variant_stock?: string;
  variant_price_override?: string;
  image_urls?: string;
  product_id?: string;
}

interface GroupedProduct {
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  category: string | null;
  in_stock: boolean;
  image_urls: string[];
  variants: Array<{
    size: string | null;
    color: string | null;
    sku: string | null;
    stock_quantity: number;
    price_override: number | null;
  }>;
}

/**
 * POST /api/products/import
 * Import products from CSV or XLSX file
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Parse the file based on type
    let rows: ImportRow[];

    if (
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls") ||
      file.type.includes("spreadsheet")
    ) {
      // XLSX parsing
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "" });
    } else {
      // CSV parsing (default)
      const text = await file.text();
      const result = Papa.parse<ImportRow>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // keep everything as strings for consistent handling
      });

      if (result.errors.length > 0) {
        return NextResponse.json(
          {
            error: "CSV parsing errors",
            details: result.errors.slice(0, 5).map((e) => e.message),
          },
          { status: 400 }
        );
      }

      rows = result.data;
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "File is empty or has no data rows" },
        { status: 400 }
      );
    }

    // Group rows by product (using product_id or name as grouping key)
    const productGroups = new Map<string, GroupedProduct>();

    for (const row of rows) {
      const name = (row.name || "").trim();
      if (!name) continue; // skip rows without a name

      // Use product_id as grouping key if present, otherwise use name
      const groupKey = row.product_id?.trim() || name;

      if (!productGroups.has(groupKey)) {
        const price = row.price ? parseFloat(row.price) : null;
        const inStock =
          row.in_stock?.toLowerCase() === "no" ||
          row.in_stock === "0" ||
          row.in_stock?.toLowerCase() === "false"
            ? false
            : true;

        productGroups.set(groupKey, {
          name,
          description: row.description?.trim() || null,
          price: price !== null && !isNaN(price) ? price : null,
          currency: row.currency?.trim() || "USD",
          category: row.category?.trim() || null,
          in_stock: inStock,
          image_urls: row.image_urls
            ? row.image_urls
                .split(";")
                .map((u) => u.trim())
                .filter(Boolean)
            : [],
          variants: [],
        });
      }

      const product = productGroups.get(groupKey)!;

      // Add variant if size or color is present
      const size = row.size?.trim() || null;
      const color = row.color?.trim() || null;

      if (size || color) {
        const stockQty = row.variant_stock
          ? parseInt(row.variant_stock)
          : 0;
        const priceOverride = row.variant_price_override
          ? parseFloat(row.variant_price_override)
          : null;

        product.variants.push({
          size,
          color,
          sku: row.sku?.trim() || null,
          stock_quantity: isNaN(stockQty) ? 0 : stockQty,
          price_override:
            priceOverride !== null && !isNaN(priceOverride)
              ? priceOverride
              : null,
        });
      }
    }

    // Create products in DB
    let created = 0;
    let variantsCreated = 0;
    const errors: string[] = [];

    for (const [, productData] of productGroups) {
      try {
        // Calculate total stock from variants or use 0
        const totalVariantStock = productData.variants.reduce(
          (sum, v) => sum + v.stock_quantity,
          0
        );

        const product = await createProduct(db, {
          business_id: businessId,
          name: productData.name,
          description: productData.description,
          price: productData.price,
          currency: productData.currency,
          category: productData.category,
          in_stock: productData.in_stock ? 1 : 0,
          stock_quantity:
            productData.variants.length > 0 ? totalVariantStock : null,
          image_urls: productData.image_urls,
        });

        created++;

        // Save variants
        if (productData.variants.length > 0) {
          await saveProductVariants(db, product.id, productData.variants);
          variantsCreated += productData.variants.length;
        }
      } catch (err) {
        errors.push(
          `Failed to create "${productData.name}": ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    // Trigger embedding regeneration after bulk import (non-blocking)
    if (created > 0) {
      triggerEmbeddingsBackground(businessId);
    }

    return NextResponse.json({
      success: true,
      created,
      variants_created: variantsCreated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import products" },
      { status: 500 }
    );
  }
}
