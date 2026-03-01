-- Migration 005: Product Variants (sizes, colors, per-variant stock tracking)
-- Run: wrangler d1 execute whatsapp-ai-agent-db --local --file=./src/db/migrations/005_product_variants.sql
-- Run: wrangler d1 execute whatsapp-ai-agent-db --remote --file=./src/db/migrations/005_product_variants.sql

-- Product variants table: one row per purchasable SKU (size/color combo)
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  size TEXT,                     -- e.g., 'S', 'M', 'L', 'XL', '42', '44'
  color TEXT,                    -- e.g., 'Black', 'White', 'Navy'
  sku TEXT,                      -- unique stock-keeping unit
  stock_quantity INTEGER DEFAULT 0,
  price_override REAL,           -- NULL = use product.price
  position INTEGER DEFAULT 0,    -- display order
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_variants_size ON product_variants(product_id, size);
CREATE INDEX IF NOT EXISTS idx_variants_color ON product_variants(product_id, color);
