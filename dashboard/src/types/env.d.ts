/**
 * Cloudflare environment bindings type declaration
 */

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    PRODUCT_IMAGES: R2Bucket;
    WORKER_URL?: string;
    WORKER_ADMIN_SECRET?: string;
  }
}

export {};
