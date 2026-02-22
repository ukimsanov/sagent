/**
 * Handoff Notification Module
 *
 * Sends email notifications when a conversation is flagged for human handoff.
 * Uses Resend API for email delivery (simple, transactional email service).
 */

import type { Business, Lead, ConversationSummary } from '../db/queries';

// ============================================================================
// Types
// ============================================================================

export interface HandoffNotificationContext {
  business: Business;
  lead: Lead;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationSummary?: ConversationSummary | null;
  dashboardUrl?: string;
}

interface ResendResponse {
  id?: string;
  error?: {
    message: string;
    name: string;
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Send handoff notification email to merchant's team.
 * Non-blocking: logs errors but doesn't throw.
 */
export async function sendHandoffNotification(
  ctx: HandoffNotificationContext,
  resendApiKey?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const handoffEmail = ctx.business.handoff_email;

  // No email configured - just log
  if (!handoffEmail) {
    console.log('📧 Handoff notification skipped: no handoff_email configured');
    return { success: false, error: 'No handoff email configured' };
  }

  // No API key - log the notification instead
  if (!resendApiKey) {
    console.log('📧 Handoff notification (would send to:', handoffEmail, ')');
    console.log('   Customer:', ctx.lead.name || 'Unknown', `(+${ctx.lead.whatsapp_number})`);
    console.log('   Reason:', ctx.reason);
    console.log('   Urgency:', ctx.urgency);
    return { success: false, error: 'No Resend API key configured' };
  }

  try {
    const emailContent = buildHandoffEmail(ctx);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${ctx.business.name} Agent <onboarding@resend.dev>`,
        to: [handoffEmail],
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      }),
    });

    const result = await response.json() as ResendResponse;

    if (!response.ok || result.error) {
      console.error('📧 Handoff email failed:', result.error?.message || 'Unknown error');
      return { success: false, error: result.error?.message };
    }

    console.log('📧 Handoff notification sent:', result.id);
    return { success: true, messageId: result.id };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('📧 Handoff notification error:', message);
    return { success: false, error: message };
  }
}

// ============================================================================
// Email Content Builder
// ============================================================================

function buildHandoffEmail(ctx: HandoffNotificationContext): {
  subject: string;
  html: string;
  text: string;
} {
  const customerName = ctx.lead.name || 'Unknown Customer';
  const phoneNumber = ctx.lead.whatsapp_number;
  const urgencyEmoji = ctx.urgency === 'high' ? '🔴' : ctx.urgency === 'medium' ? '🟡' : '🟢';

  const subject = `${urgencyEmoji} Handoff Required: ${customerName} (+${phoneNumber})`;

  // Build recent messages summary
  let messagesHtml = '';
  let messagesText = '';

  if (ctx.recentMessages && ctx.recentMessages.length > 0) {
    const recent = ctx.recentMessages.slice(-5);
    messagesHtml = recent.map(m => `
      <div style="margin: 8px 0; padding: 8px; background: ${m.role === 'user' ? '#e3f2fd' : '#f5f5f5'}; border-radius: 4px;">
        <strong>${m.role === 'user' ? 'Customer' : 'Agent'}:</strong> ${escapeHtml(m.content)}
      </div>
    `).join('');

    messagesText = recent.map(m =>
      `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`
    ).join('\n');
  }

  // Build customer context
  let contextHtml = '';
  let contextText = '';

  if (ctx.conversationSummary) {
    const interests = safeParseJson(ctx.conversationSummary.key_interests);
    const objections = safeParseJson(ctx.conversationSummary.objections);

    if (interests.length > 0) {
      contextHtml += `<p><strong>Interests:</strong> ${interests.join(', ')}</p>`;
      contextText += `Interests: ${interests.join(', ')}\n`;
    }
    if (objections.length > 0) {
      contextHtml += `<p><strong>Concerns:</strong> ${objections.join(', ')}</p>`;
      contextText += `Concerns: ${objections.join(', ')}\n`;
    }
  }

  // Dashboard link
  const dashboardLink = ctx.dashboardUrl
    ? `<p><a href="${ctx.dashboardUrl}/conversations/${ctx.lead.id}" style="color: #1976d2;">View full conversation in dashboard →</a></p>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1976d2; color: white; padding: 16px; border-radius: 8px 8px 0 0; }
    .content { background: #fff; border: 1px solid #e0e0e0; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; }
    .urgency { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
    .urgency-high { background: #ffebee; color: #c62828; }
    .urgency-medium { background: #fff3e0; color: #e65100; }
    .urgency-low { background: #e8f5e9; color: #2e7d32; }
    .info-box { background: #f5f5f5; padding: 12px; border-radius: 4px; margin: 16px 0; }
    .messages { margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Human Handoff Required</h2>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">${ctx.business.name}</p>
    </div>
    <div class="content">
      <p>
        <span class="urgency urgency-${ctx.urgency}">${ctx.urgency.toUpperCase()}</span>
      </p>

      <div class="info-box">
        <p style="margin: 0;"><strong>Customer:</strong> ${escapeHtml(customerName)}</p>
        <p style="margin: 4px 0 0 0;"><strong>Phone:</strong> +${phoneNumber}</p>
        <p style="margin: 4px 0 0 0;"><strong>Reason:</strong> ${escapeHtml(ctx.reason)}</p>
        <p style="margin: 4px 0 0 0;"><strong>Lead Score:</strong> ${ctx.lead.score}/100</p>
        <p style="margin: 4px 0 0 0;"><strong>Messages:</strong> ${ctx.lead.message_count}</p>
      </div>

      ${contextHtml ? `<div class="info-box">${contextHtml}</div>` : ''}

      ${messagesHtml ? `
        <h3>Recent Messages</h3>
        <div class="messages">${messagesHtml}</div>
      ` : ''}

      ${dashboardLink}

      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p style="font-size: 12px; color: #666;">
        Reply to this customer on WhatsApp: <a href="https://wa.me/${phoneNumber}">wa.me/${phoneNumber}</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
HUMAN HANDOFF REQUIRED - ${ctx.business.name}
Urgency: ${ctx.urgency.toUpperCase()}

CUSTOMER DETAILS
Name: ${customerName}
Phone: +${phoneNumber}
Reason: ${ctx.reason}
Lead Score: ${ctx.lead.score}/100
Messages: ${ctx.lead.message_count}

${contextText}
${messagesText ? `RECENT MESSAGES\n${messagesText}` : ''}

Reply on WhatsApp: https://wa.me/${phoneNumber}
`;

  return { subject, html, text };
}

// ============================================================================
// Helpers
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeParseJson(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
