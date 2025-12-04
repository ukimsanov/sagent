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
  address TEXT, -- Physical store address for store_visit goal
  goals TEXT, -- JSON array: ["store_visit", "lead_capture", "appointment", ...]

  -- Phase 4: B2B tenant config
  brand_tone TEXT DEFAULT 'friendly', -- 'friendly', 'professional', 'casual'
  greeting_template TEXT, -- Custom greeting message (replaces default)
  escalation_keywords TEXT, -- JSON array of keywords that trigger handoff
  after_hours_message TEXT, -- Custom message outside working_hours
  handoff_email TEXT, -- Email to notify on handoff
  handoff_phone TEXT, -- Phone to notify on handoff (optional)
  auto_handoff_threshold INTEGER DEFAULT 3, -- Clarifications before auto-handoff

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
  image_url TEXT, -- JSON array: '["url1"]' for one image, '["url1", "url2"]' for multiple
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
  email TEXT, -- For lead_capture goal
  preferred_contact TEXT, -- 'whatsapp', 'phone', 'email' for lead_capture goal
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
  message_count INTEGER DEFAULT 0, -- H7 FIX: Track messages covered to prevent race conditions
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

-- Appointments for consultation/fitting booking (appointment goal)
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  requested_date TEXT, -- e.g., "2025-12-15"
  requested_time TEXT, -- e.g., "14:00"
  notes TEXT, -- What the appointment is for
  status TEXT DEFAULT 'pending', -- pending, confirmed, cancelled
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_appointments_business ON appointments(business_id, status);
CREATE INDEX IF NOT EXISTS idx_appointments_lead ON appointments(lead_id);

-- Callback requests (callback_request goal)
CREATE TABLE IF NOT EXISTS callback_requests (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  preferred_time TEXT, -- e.g., "tomorrow afternoon"
  reason TEXT, -- Why they want a callback
  status TEXT DEFAULT 'pending', -- pending, completed
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_callbacks_business ON callback_requests(business_id, status);

-- Promo codes pool (promo_delivery goal)
CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  code TEXT NOT NULL, -- e.g., "SAVE10", "WELCOME20"
  discount_percent INTEGER, -- e.g., 10 for 10% off
  discount_amount REAL, -- Alternative: fixed amount off
  used_by_lead_id TEXT, -- NULL if unused, lead_id if used
  expires_at INTEGER, -- Unix timestamp
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_promos_unused ON promo_codes(business_id, used_by_lead_id);

-- Message events for analytics (Phase 3)
CREATE TABLE IF NOT EXISTS message_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,

  -- Action tracking (from HandlerResponse)
  action TEXT NOT NULL,  -- show_products, ask_clarification, answer_question, empathize, greet, thank, handoff
  intent_type TEXT,      -- greeting, thanks, product_search, complaint, etc.

  -- Message details
  user_message TEXT,
  agent_response TEXT,

  -- Search context (when applicable)
  search_query TEXT,
  products_shown TEXT,   -- JSON array of product IDs

  -- Flags
  flagged_for_human INTEGER DEFAULT 0,
  clarification_count INTEGER DEFAULT 0,

  -- Performance
  processing_time_ms INTEGER,

  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_message_events_business ON message_events(business_id);
CREATE INDEX IF NOT EXISTS idx_message_events_timestamp ON message_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_message_events_action ON message_events(action);
CREATE INDEX IF NOT EXISTS idx_message_events_lead ON message_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_message_events_business_timestamp ON message_events(business_id, timestamp DESC);

-- Dead Letter Queue for failed operations (Phase 5: Reliability)
-- Used to track and retry failed background operations
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,  -- 'lead_score', 'handoff_notification', 'message_send', etc.
  entity_id TEXT NOT NULL,       -- ID of the affected entity (lead_id, business_id, etc.)
  error_message TEXT NOT NULL,
  payload TEXT,                  -- JSON of the original operation payload
  created_at INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0,
  last_retry_at INTEGER,
  resolved_at INTEGER,
  resolved_by TEXT              -- 'auto_retry', 'manual', etc.
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_type ON dead_letter_queue(operation_type);
CREATE INDEX IF NOT EXISTS idx_dead_letter_created ON dead_letter_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_dead_letter_unresolved ON dead_letter_queue(resolved_at) WHERE resolved_at IS NULL;

-- User to Business mapping for multi-tenancy (WorkOS integration)
-- Links WorkOS user IDs to business accounts
CREATE TABLE IF NOT EXISTS user_businesses (
  id TEXT PRIMARY KEY,
  workos_user_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  role TEXT DEFAULT 'admin', -- 'admin', 'member', 'viewer'
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  UNIQUE(workos_user_id, business_id),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_businesses_workos ON user_businesses(workos_user_id);
CREATE INDEX IF NOT EXISTS idx_user_businesses_business ON user_businesses(business_id);
