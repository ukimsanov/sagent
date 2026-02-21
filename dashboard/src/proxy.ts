/**
 * WorkOS AuthKit Proxy (Next.js 16)
 *
 * Protects all routes except:
 * - /auth/* (login, callback, logout)
 * - Static files (_next, favicon, etc.)
 *
 * Docs: https://workos.com/docs/authkit/nextjs
 */

import { authkitMiddleware } from '@workos-inc/authkit-nextjs';
import { NextRequest, NextFetchEvent } from 'next/server';

const baseProxy = authkitMiddleware({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      '/',
      '/auth/:path*',
    ],
  },
});

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  return baseProxy(request, event);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
