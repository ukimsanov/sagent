import { NextRequest, NextResponse } from "next/server";
import { getDB, updateBusinessConfig } from "@/lib/db";

// Note: OpenNext for Cloudflare uses Node.js runtime, not edge
// See: https://opennext.js.org/cloudflare

interface SettingsBody {
  businessId: string;
  brand_tone?: string;
  greeting_template?: string;
  handoff_email?: string;
  handoff_phone?: string;
  auto_handoff_threshold?: number;
  escalation_keywords?: string;
  timezone?: string;
  working_hours?: string;
  after_hours_message?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SettingsBody;
    const { businessId, ...config } = body;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business ID is required" },
        { status: 400 }
      );
    }

    const db = await getDB();

    // Build the config object with only the fields that were provided
    const updateConfig: Record<string, string | number | null> = {};

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
