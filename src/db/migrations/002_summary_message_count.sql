-- H7 FIX: Add message_count to prevent summary race conditions
-- Only update summary if new message_count > existing message_count

ALTER TABLE conversation_summaries ADD COLUMN message_count INTEGER DEFAULT 0;

-- Create index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_lead_count
  ON conversation_summaries(lead_id, message_count);
