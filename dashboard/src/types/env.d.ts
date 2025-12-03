/**
 * Cloudflare environment bindings type declaration
 */

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};
