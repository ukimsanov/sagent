import { NextRequest, NextResponse } from "next/server";
import { getDB, updateBusinessConfig } from "@/lib/db";
import { requireBusinessId } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";

// Note: OpenNext for Cloudflare uses Node.js runtime, not edge
// See: https://opennext.js.org/cloudflare

interface SettingsBody {
  whatsapp_phone_id?: string;
  ai_enabled?: number;
  brand_tone?: string;
  greeting_template?: string;
  handoff_email?: string;
  handoff_phone?: string;
  auto_handoff_threshold?: number;
  escalation_keywords?: string;
  timezone?: string;
  working_hours?: string;
  after_hours_message?: string;
  // Phase 6: Automation settings
  digest_email?: string;
  digest_daily_enabled?: number;
  digest_weekly_enabled?: number;
  follow_up_enabled?: number;
  follow_up_delay_hours?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const db = await getDB();
    const businessId = await requireBusinessId(db, user.id);

    const config = await request.json() as SettingsBody;

    // Build the config object with only the fields that were provided
    const updateConfig: Record<string, string | number | null> = {};

    // WhatsApp connection
    if (config.whatsapp_phone_id !== undefined) {
      updateConfig.whatsapp_phone_id = config.whatsapp_phone_id.trim();
    }

    // AI status
    if (config.ai_enabled !== undefined) {
      updateConfig.ai_enabled = config.ai_enabled;
    }

    // Brand settings
    if (config.brand_tone !== undefined) {
      updateConfig.brand_tone = config.brand_tone || null;
    }
    if (config.greeting_template !== undefined) {
      updateConfig.greeting_template = config.greeting_template || null;
    }

    // Handoff settings
    if (config.handoff_email !== undefined) {
      updateConfig.handoff_email = config.handoff_email || null;
    }
    if (config.handoff_phone !== undefined) {
      updateConfig.handoff_phone = config.handoff_phone || null;
    }
    if (config.auto_handoff_threshold !== undefined) {
      updateConfig.auto_handoff_threshold = config.auto_handoff_threshold;
    }
    if (config.escalation_keywords !== undefined) {
      updateConfig.escalation_keywords = config.escalation_keywords || null;
    }

    // Hours settings
    if (config.timezone !== undefined) {
      updateConfig.timezone = config.timezone || null;
    }
    if (config.working_hours !== undefined) {
      updateConfig.working_hours = config.working_hours || null;
    }
    if (config.after_hours_message !== undefined) {
      updateConfig.after_hours_message = config.after_hours_message || null;
    }

    // Automation settings
    if (config.digest_email !== undefined) {
      updateConfig.digest_email = config.digest_email || null;
    }
    if (config.digest_daily_enabled !== undefined) {
      updateConfig.digest_daily_enabled = config.digest_daily_enabled;
    }
    if (config.digest_weekly_enabled !== undefined) {
      updateConfig.digest_weekly_enabled = config.digest_weekly_enabled;
    }
    if (config.follow_up_enabled !== undefined) {
      updateConfig.follow_up_enabled = config.follow_up_enabled;
    }
    if (config.follow_up_delay_hours !== undefined) {
      updateConfig.follow_up_delay_hours = config.follow_up_delay_hours;
    }

    await updateBusinessConfig(db, businessId, updateConfig);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
