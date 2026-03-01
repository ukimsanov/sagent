import { NextRequest } from "next/server";
import { getDB, getProducts, getVariantsForProduct } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

/**
 * GET /api/products/export?format=csv|xlsx
 * Export all products with variants as CSV or XLSX
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";

    // Fetch all products
    const { products } = await getProducts(db, businessId, { limit: 10000 });

    // Build rows: one row per variant, products without variants get one row
    const headers = [
      "product_id",
      "name",
      "description",
      "price",
      "currency",
      "category",
      "in_stock",
      "size",
      "color",
      "sku",
      "variant_stock",
      "variant_price_override",
      "image_urls",
    ];

    const rows: string[][] = [headers];

    for (const product of products) {
      const variants = await getVariantsForProduct(db, product.id);

      if (variants.length === 0) {
        // Product without variants: one row
        rows.push([
          product.id,
          product.name,
          product.description || "",
          product.price?.toString() || "",
          product.currency,
          product.category || "",
          product.in_stock ? "yes" : "no",
          "",
          "",
          "",
          product.stock_quantity?.toString() || "",
          "",
          product.image_urls.join(";"),
        ]);
      } else {
        // One row per variant
        for (const v of variants) {
          rows.push([
            product.id,
            product.name,
            product.description || "",
            product.price?.toString() || "",
            product.currency,
            product.category || "",
            product.in_stock ? "yes" : "no",
            v.size || "",
            v.color || "",
            v.sku || "",
            v.stock_quantity.toString(),
            v.price_override?.toString() || "",
            product.image_urls.join(";"),
          ]);
        }
      }
    }

    if (format === "xlsx") {
      // Dynamic import for xlsx to keep bundle small
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new Response(buf, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="products_${new Date().toISOString().slice(0, 10)}.xlsx"`,
        },
      });
    }

    // Default: CSV with UTF-8 BOM for Excel/Cyrillic compatibility
    const BOM = "\uFEFF";
    const csvContent = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\r\n");

    return new Response(BOM + csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="products_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response("Failed to export products", { status: 500 });
  }
}
