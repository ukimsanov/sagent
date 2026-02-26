/**
 * Digest Engine — Email Digests for Business Owners
 *
 * Builds metrics for daily/weekly digests and sends them via Resend.
 * Reuses the same email pattern as handoff.ts.
 */

import type { Business } from '../db/queries';

// ============================================================================
// Types
// ============================================================================

export interface DigestMetrics {
  totalMessages: number;
  uniqueLeads: number;
  newLeads: number;
  aiResolutionRate: number;
  handoffCount: number;
  openEscalations: number;
  hotLeads: Array<{ name: string | null; score: number; whatsapp_number: string }>;
  zeroResultSearches: Array<{ query: string; count: number }>;
}

// ============================================================================
// Metrics Builder
// ============================================================================

export async function buildDigestMetrics(
  db: D1Database,
  businessId: string,
  startTime: number,
  endTime: number,
): Promise<DigestMetrics> {
  const [
    msgCount,
    uniqueLeadsResult,
    newLeadsResult,
    handoffResult,
    openEscResult,
    hotLeadsResult,
    zeroSearchResult,
  ] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) as count FROM message_events WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?`,
    ).bind(businessId, startTime, endTime).first<{ count: number }>(),

    db.prepare(
      `SELECT COUNT(DISTINCT lead_id) as count FROM message_events WHERE business_id = ? AND timestamp >= ? AND timestamp <= ?`,
    ).bind(businessId, startTime, endTime).first<{ count: number }>(),

    db.prepare(
      `SELECT COUNT(*) as count FROM leads WHERE business_id = ? AND first_contact >= ?`,
    ).bind(businessId, Math.floor(startTime / 1000)).first<{ count: number }>(),

    db.prepare(
      `SELECT COUNT(*) as count FROM message_events WHERE business_id = ? AND timestamp >= ? AND timestamp <= ? AND (action = 'handoff' OR flagged_for_human = 1)`,
    ).bind(businessId, startTime, endTime).first<{ count: number }>(),

    db.prepare(
      `SELECT COUNT(*) as count FROM human_flags hf JOIN leads l ON hf.lead_id = l.id WHERE l.business_id = ? AND hf.resolved = 0`,
    ).bind(businessId).first<{ count: number }>(),

    db.prepare(
      `SELECT name, score, whatsapp_number FROM leads WHERE business_id = ? AND status = 'hot' ORDER BY score DESC LIMIT 5`,
    ).bind(businessId).all<{ name: string | null; score: number; whatsapp_number: string }>(),

    db.prepare(
      `SELECT search_query as query, COUNT(*) as count FROM message_events WHERE business_id = ? AND timestamp >= ? AND timestamp <= ? AND search_query IS NOT NULL AND products_shown IS NULL GROUP BY LOWER(search_query) HAVING count >= 2 ORDER BY count DESC LIMIT 5`,
    ).bind(businessId, startTime, endTime).all<{ query: string; count: number }>(),
  ]);

  const totalMessages = msgCount?.count || 0;
  const handoffCount = handoffResult?.count || 0;
  const aiResolutionRate = totalMessages > 0
    ? Math.round(((totalMessages - handoffCount) / totalMessages) * 100)
    : 0;

  return {
    totalMessages,
    uniqueLeads: uniqueLeadsResult?.count || 0,
    newLeads: newLeadsResult?.count || 0,
    aiResolutionRate,
    handoffCount,
    openEscalations: openEscResult?.count || 0,
    hotLeads: hotLeadsResult?.results || [],
    zeroResultSearches: zeroSearchResult?.results || [],
  };
}

// ============================================================================
// Email Sender
// ============================================================================

export async function sendDigestEmail(
  business: Business,
  metrics: DigestMetrics,
  periodLabel: string,
  digestEmail: string,
  resendApiKey: string,
  dashboardUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const email = buildDigestEmailContent(business, metrics, periodLabel, dashboardUrl);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${business.name} Agent <onboarding@resend.dev>`,
        to: [digestEmail],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });

    const result = await response.json() as { id?: string; error?: { message: string } };

    if (!response.ok || result.error) {
      console.error(`[Digest] Email failed for ${business.id}:`, result.error?.message);
      return { success: false, error: result.error?.message || 'Unknown error' };
    }

    console.log(`[Digest] Email sent to ${digestEmail} for ${business.name}: ${result.id}`);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Digest] Email error for ${business.id}:`, msg);
    return { success: false, error: msg };
  }
}

// ============================================================================
// Email Content Builder
// ============================================================================

function buildDigestEmailContent(
  business: Business,
  metrics: DigestMetrics,
  periodLabel: string,
  dashboardUrl?: string,
): { subject: string; html: string; text: string } {
  const subject = `${periodLabel} Digest — ${business.name}`;

  // Attention items
  const attentionItems: string[] = [];
  if (metrics.openEscalations > 0) {
    attentionItems.push(`${metrics.openEscalations} unresolved escalation${metrics.openEscalations > 1 ? 's' : ''}`);
  }
  for (const s of metrics.zeroResultSearches.slice(0, 3)) {
    attentionItems.push(`"${s.query}" searched ${s.count}x (not in catalog)`);
  }
  for (const lead of metrics.hotLeads.slice(0, 3)) {
    const name = lead.name || `+${lead.whatsapp_number}`;
    attentionItems.push(`Hot lead: ${name} (score: ${lead.score})`);
  }

  const attentionHtml = attentionItems.length > 0
    ? `<div style="background:#fff3e0;padding:12px;border-radius:4px;margin:16px 0;"><strong>Needs Attention:</strong><ul style="margin:8px 0 0 0;padding-left:20px;">${attentionItems.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`
    : '';

  const dashboardLink = dashboardUrl
    ? `<p style="margin:16px 0;"><a href="${dashboardUrl}" style="display:inline-block;background:#1976d2;color:white;padding:8px 16px;border-radius:4px;text-decoration:none;">View Dashboard &rarr;</a></p>`
    : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;color:#333;}.container{max-width:600px;margin:0 auto;padding:20px;}.header{background:#1976d2;color:white;padding:16px;border-radius:8px 8px 0 0;}.content{background:#fff;border:1px solid #e0e0e0;border-top:none;padding:20px;border-radius:0 0 8px 8px;}.stats{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;}.stat{background:#f5f5f5;padding:12px;border-radius:4px;flex:1;min-width:120px;text-align:center;}.stat-value{font-size:24px;font-weight:bold;color:#1976d2;}.stat-label{font-size:12px;color:#666;}</style></head><body><div class="container"><div class="header"><h2 style="margin:0;">${periodLabel} Digest</h2><p style="margin:8px 0 0 0;opacity:0.9;">${escapeHtml(business.name)}</p></div><div class="content"><div class="stats"><div class="stat"><div class="stat-value">${metrics.totalMessages}</div><div class="stat-label">Messages</div></div><div class="stat"><div class="stat-value">${metrics.newLeads}</div><div class="stat-label">New Leads</div></div><div class="stat"><div class="stat-value">${metrics.aiResolutionRate}%</div><div class="stat-label">AI Resolution</div></div><div class="stat"><div class="stat-value">${metrics.handoffCount}</div><div class="stat-label">Handoffs</div></div></div>${attentionHtml}${dashboardLink}<hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0;"><p style="font-size:12px;color:#666;">You're receiving this because you enabled digest emails. Manage in dashboard settings.</p></div></div></body></html>`;

  const attentionText = attentionItems.length > 0
    ? `\nNEEDS ATTENTION:\n${attentionItems.map(i => `- ${i}`).join('\n')}\n`
    : '';

  const text = `${periodLabel} DIGEST — ${business.name}\n\nMessages: ${metrics.totalMessages} | New Leads: ${metrics.newLeads}\nAI Resolution: ${metrics.aiResolutionRate}% | Handoffs: ${metrics.handoffCount}\n${attentionText}\n${dashboardUrl ? `View Dashboard: ${dashboardUrl}` : ''}`;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
