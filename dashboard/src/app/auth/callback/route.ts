/**
 * OAuth Callback Route
 *
 * Handles the redirect from WorkOS after authentication.
 * Sets the session cookie and redirects to the dashboard.
 *
 * Make sure NEXT_PUBLIC_WORKOS_REDIRECT_URI is set to:
 * http://localhost:3000/auth/callback (dev)
 * https://your-domain.com/auth/callback (prod)
 */

import { handleAuth } from '@workos-inc/authkit-nextjs';

export const GET = handleAuth({ returnPathname: '/' });
