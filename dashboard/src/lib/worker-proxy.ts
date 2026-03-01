/**
 * Worker Proxy — Black box module for Worker admin API communication
 *
 * Encapsulates all calls from the Dashboard to the Worker's admin endpoints.
 * Only the Worker has WhatsApp credentials and Durable Object bindings,
 * so operations like sending messages must be proxied through it.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

interface WorkerConfig {
  workerUrl: string;
  adminSecret: string;
}

async function getWorkerConfig(): Promise<WorkerConfig> {
  const { env } = await getCloudflareContext();
  const workerUrl = (env as unknown as Record<string, string>).WORKER_URL;
  const adminSecret = (env as unknown as Record<string, string>).WORKER_ADMIN_SECRET;
  if (!workerUrl || !adminSecret) {
    throw new Error("WORKER_URL and WORKER_ADMIN_SECRET must be configured");
  }
  return { workerUrl, adminSecret };
}

/**
 * Send a WhatsApp message via the Worker's admin endpoint.
 * Used for human agent replies from the dashboard.
 */
export async function sendWhatsAppMessage(
  businessId: string,
  phoneNumber: string,
  message: string,
  leadId?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { workerUrl, adminSecret } = await getWorkerConfig();

  const response = await fetch(`${workerUrl}/admin/send-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ businessId, phoneNumber, message, leadId }),
  });

  return response.json() as Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

/**
 * Trigger product embedding regeneration for a business.
 * Calls the Worker's /admin/embed/business endpoint which regenerates
 * all product vectors in Cloudflare Vectorize for semantic search.
 */
export async function triggerEmbeddings(
  businessId: string,
): Promise<{ success: boolean; embedded?: number; error?: string }> {
  const { workerUrl, adminSecret } = await getWorkerConfig();

  const response = await fetch(`${workerUrl}/admin/embed/business`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ business_id: businessId }),
  });

  return response.json() as Promise<{
    success: boolean;
    embedded?: number;
    error?: string;
  }>;
}

/**
 * Fire-and-forget embedding trigger.
 * Used after product mutations to keep the search index fresh.
 * Failures are logged but never block the caller.
 */
export async function triggerEmbeddingsBackground(
  businessId: string,
): Promise<void> {
  try {
    await triggerEmbeddings(businessId);
  } catch (err) {
    console.error("Background embedding trigger failed:", err);
  }
}
