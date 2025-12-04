-- Migration: Add Phase 4 B2B tenant configuration columns
-- Run with: wrangler d1 execute whatsapp-ai-agent-db --local --file=./src/db/migrations/001_tenant_config.sql

-- Brand voice settings
ALTER TABLE businesses ADD COLUMN brand_tone TEXT DEFAULT 'friendly';
ALTER TABLE businesses ADD COLUMN greeting_template TEXT;
ALTER TABLE businesses ADD COLUMN escalation_keywords TEXT;

-- After hours
ALTER TABLE businesses ADD COLUMN after_hours_message TEXT;

-- Handoff settings
ALTER TABLE businesses ADD COLUMN handoff_email TEXT;
ALTER TABLE businesses ADD COLUMN handoff_phone TEXT;
ALTER TABLE businesses ADD COLUMN auto_handoff_threshold INTEGER DEFAULT 3;
