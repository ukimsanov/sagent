-- WhatsApp AI Agent Database Schema
-- Run with: wrangler d1 execute whatsapp-ai-agent-db --local --file=./src/db/schema.sql

-- Business configuration
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp_phone_id TEXT NOT NULL,
  system_prompt TEXT,
  working_hours TEXT, -- JSON: {"mon": "9-18", "tue": "9-18", ...}
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Products/Services catalog
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price REAL,
  currency TEXT DEFAULT 'USD',
  category TEXT,
  in_stock INTEGER DEFAULT 1,
  stock_quantity INTEGER,
  metadata TEXT, -- JSON for sizes, colors, variants, etc.
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Create index for product search
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(business_id, category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Lead tracking
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  name TEXT,
  score INTEGER DEFAULT 0, -- 0-100 lead warmth
  status TEXT DEFAULT 'new', -- new, engaged, warm, hot, converted, lost
  tags TEXT, -- JSON array
  first_contact INTEGER DEFAULT (unixepoch()),
  last_contact INTEGER DEFAULT (unixepoch()),
  message_count INTEGER DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Unique constraint: one lead per phone number per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique ON leads(business_id, whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(business_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(business_id, score DESC);

-- Conversation summaries (for LLM context, not full history)
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL UNIQUE,
  summary TEXT,
  key_interests TEXT, -- JSON array of product interests
  objections TEXT, -- JSON array of objections raised
  next_steps TEXT, -- What the customer needs/wants next
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Flagged conversations for human follow-up
CREATE TABLE IF NOT EXISTS human_flags (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  urgency TEXT DEFAULT 'medium', -- low, medium, high
  reason TEXT NOT NULL,
  resolved INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  resolved_at INTEGER,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_flags_unresolved ON human_flags(lead_id, resolved, urgency);
