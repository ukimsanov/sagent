/**
 * Logout Route
 *
 * Signs out the user and clears the session.
 * Redirects to the landing page after logout.
 */

import { signOut } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

export const GET = async (request: Request) => {
  console.log("[LOGOUT ROUTE] GET /auth/logout hit!");
  console.log("[LOGOUT ROUTE] Timestamp:", new Date().toISOString());
  console.log("[LOGOUT ROUTE] Referer:", request.headers.get('referer'));
  console.log("[LOGOUT ROUTE] User-Agent:", request.headers.get('user-agent'));
  await signOut();
  return redirect('/');
};
