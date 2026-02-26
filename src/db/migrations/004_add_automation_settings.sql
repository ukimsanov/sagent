-- Migration 004: Automation settings for Email Digests, Smart Follow-ups, Auto-FAQ
-- Run: wrangler d1 execute whatsapp-ai-agent-db --local --file=./src/db/migrations/004_add_automation_settings.sql
-- Run: wrangler d1 execute whatsapp-ai-agent-db --remote --file=./src/db/migrations/004_add_automation_settings.sql

-- Business columns for Email Digests
ALTER TABLE businesses ADD COLUMN digest_email TEXT;
ALTER TABLE businesses ADD COLUMN digest_daily_enabled INTEGER DEFAULT 0;
ALTER TABLE businesses ADD COLUMN digest_weekly_enabled INTEGER DEFAULT 0;

-- Business columns for Smart Follow-ups
ALTER TABLE businesses ADD COLUMN follow_up_enabled INTEGER DEFAULT 0;
ALTER TABLE businesses ADD COLUMN follow_up_delay_hours INTEGER DEFAULT 4;

-- Follow-ups tracking table
CREATE TABLE IF NOT EXISTS follow_ups (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  created_at INTEGER DEFAULT (unixepoch()),
  sent_at INTEGER,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_follow_ups_business ON follow_ups(business_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead ON follow_ups(lead_id, created_at);

-- Auto-FAQs table
CREATE TABLE IF NOT EXISTS auto_faqs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  source_intents TEXT,
  status TEXT DEFAULT 'draft',
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auto_faqs_business ON auto_faqs(business_id, status);
CREATE INDEX IF NOT EXISTS idx_auto_faqs_frequency ON auto_faqs(business_id, frequency DESC);
