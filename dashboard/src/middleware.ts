/**
 * WorkOS AuthKit Middleware
 *
 * Protects all routes except:
 * - /auth/* (login, callback, logout)
 * - /api/* (API routes handle their own auth)
 * - Static files (_next, favicon, etc.)
 *
 * Docs: https://workos.com/docs/authkit/nextjs
 */

import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

export default authkitMiddleware({
  debug: true, // Enable debug logs to troubleshoot session issues
  middlewareAuth: {
    enabled: true,
    // Routes that don't require authentication
    unauthenticatedPaths: [
      '/',           // Landing page (we'll redirect from here if needed)
      '/auth/:path*', // All auth routes (login, callback, logout)
    ],
  },
});

export const config = {
  // Match all routes except static files and API routes
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
