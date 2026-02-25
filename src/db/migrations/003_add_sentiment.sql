-- Migration: Add sentiment column to message_events for tracking customer mood
-- Run with: wrangler d1 execute whatsapp-ai-agent-db --file=./src/db/migrations/003_add_sentiment.sql

ALTER TABLE message_events ADD COLUMN sentiment TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_message_events_sentiment ON message_events(business_id, sentiment);
