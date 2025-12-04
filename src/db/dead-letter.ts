/**
 * Dead Letter Queue utilities
 *
 * Logs failed background operations for later retry or manual review.
 * Part of Phase 5 reliability fixes.
 */

// ============================================================================
// Types
// ============================================================================

export interface DeadLetterEntry {
  id: string;
  operation_type: string;
  entity_id: string;
  error_message: string;
  payload: string | null;
  created_at: number;
  retry_count: number;
  last_retry_at: number | null;
  resolved_at: number | null;
  resolved_by: string | null;
}

export type OperationType =
  | 'lead_score'
  | 'handoff_notification'
  | 'message_send'
  | 'conversation_summary'
  | 'analytics_event'
  | 'webhook_process';

// ============================================================================
// Functions
// ============================================================================

/**
 * Log a failed operation to the dead letter queue
 */
export async function logToDeadLetter(
  db: D1Database,
  operationType: OperationType,
  entityId: string,
  errorMessage: string,
  payload?: unknown
): Promise<void> {
  try {
    const id = `dlq-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    await db.prepare(`
      INSERT INTO dead_letter_queue
        (id, operation_type, entity_id, error_message, payload, created_at, retry_count)
      VALUES
        (?, ?, ?, ?, ?, ?, 0)
    `).bind(
      id,
      operationType,
      entityId,
      errorMessage.substring(0, 1000), // Truncate long error messages
      payload ? JSON.stringify(payload) : null,
      Date.now()
    ).run();

    console.log(`📬 Logged to dead letter queue: ${operationType} for ${entityId}`);
  } catch (err) {
    // Don't let dead letter logging fail the main operation
    console.error('Failed to log to dead letter queue:', err);
  }
}

/**
 * Get unresolved entries from the dead letter queue
 */
export async function getUnresolvedEntries(
  db: D1Database,
  operationType?: OperationType,
  limit: number = 100
): Promise<DeadLetterEntry[]> {
  let query = `
    SELECT * FROM dead_letter_queue
    WHERE resolved_at IS NULL
  `;

  if (operationType) {
    query += ` AND operation_type = ?`;
  }

  query += ` ORDER BY created_at ASC LIMIT ?`;

  const stmt = operationType
    ? db.prepare(query).bind(operationType, limit)
    : db.prepare(query).bind(limit);

  const result = await stmt.all<DeadLetterEntry>();
  return result.results || [];
}

/**
 * Mark an entry as resolved
 */
export async function resolveEntry(
  db: D1Database,
  entryId: string,
  resolvedBy: 'auto_retry' | 'manual' | 'expired'
): Promise<void> {
  await db.prepare(`
    UPDATE dead_letter_queue
    SET resolved_at = ?, resolved_by = ?
    WHERE id = ?
  `).bind(Date.now(), resolvedBy, entryId).run();
}

/**
 * Increment retry count for an entry
 */
export async function incrementRetryCount(
  db: D1Database,
  entryId: string
): Promise<void> {
  await db.prepare(`
    UPDATE dead_letter_queue
    SET retry_count = retry_count + 1, last_retry_at = ?
    WHERE id = ?
  `).bind(Date.now(), entryId).run();
}

/**
 * Get dead letter queue stats
 */
export async function getDeadLetterStats(
  db: D1Database
): Promise<{
  total: number;
  unresolved: number;
  byType: Record<string, number>;
}> {
  const totalResult = await db.prepare(`
    SELECT COUNT(*) as count FROM dead_letter_queue
  `).first<{ count: number }>();

  const unresolvedResult = await db.prepare(`
    SELECT COUNT(*) as count FROM dead_letter_queue WHERE resolved_at IS NULL
  `).first<{ count: number }>();

  const byTypeResult = await db.prepare(`
    SELECT operation_type, COUNT(*) as count
    FROM dead_letter_queue
    WHERE resolved_at IS NULL
    GROUP BY operation_type
  `).all<{ operation_type: string; count: number }>();

  const byType: Record<string, number> = {};
  for (const row of byTypeResult.results || []) {
    byType[row.operation_type] = row.count;
  }

  return {
    total: totalResult?.count || 0,
    unresolved: unresolvedResult?.count || 0,
    byType,
  };
}
