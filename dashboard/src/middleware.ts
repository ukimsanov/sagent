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
import { NextRequest, NextResponse, NextFetchEvent } from 'next/server';

const baseMiddleware = authkitMiddleware({
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

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const cookies = request.cookies.getAll();
  const sessionCookie = cookies.find(c => c.name.includes('wos-session'));

  console.log("[MIDDLEWARE] ================================");
  console.log("[MIDDLEWARE] Path:", pathname);
  console.log("[MIDDLEWARE] Method:", request.method);
  console.log("[MIDDLEWARE] Has session cookie:", !!sessionCookie);
  console.log("[MIDDLEWARE] Cookie names:", cookies.map(c => c.name).join(', '));
  console.log("[MIDDLEWARE] Referer:", request.headers.get('referer'));
  console.log("[MIDDLEWARE] Timestamp:", new Date().toISOString());

  const response = await baseMiddleware(request, event);

  // Log if there's a redirect
  if (response instanceof NextResponse) {
    const location = response.headers.get('location');
    if (location) {
      console.log("[MIDDLEWARE] REDIRECT TO:", location);
    }
  }

  console.log("[MIDDLEWARE] ================================");
  return response;
}

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
