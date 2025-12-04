/**
 * Login Route
 *
 * Redirects to WorkOS hosted sign-in page.
 * Users can sign in with email/password or social providers.
 */

import { getSignInUrl } from '@workos-inc/authkit-nextjs';
import { redirect } from 'next/navigation';

export const GET = async () => {
  const signInUrl = await getSignInUrl();
  return redirect(signInUrl);
};
