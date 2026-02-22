/**
 * WorkOS AuthKit Middleware
 *
 * Protects all routes except:
 * - /auth/* (login, callback, logout)
 * - Static files (_next, favicon, etc.)
 *
 * Note: Using middleware.ts (not proxy.ts) for OpenNext/Cloudflare compatibility.
 * See: https://github.com/opennextjs/opennextjs-cloudflare/issues/962
 *
 * Docs: https://workos.com/docs/authkit/nextjs
 */

import { authkitMiddleware } from '@workos-inc/authkit-nextjs';
import { NextRequest, NextFetchEvent } from 'next/server';

const authMiddleware = authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      '/',
      '/auth/:path*',
    ],
  },
});

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  return authMiddleware(request, event);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
