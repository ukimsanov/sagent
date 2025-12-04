/**
 * Auth Types
 *
 * WorkOS User type definition based on @workos-inc/node
 * We define our own interface to avoid importing the entire @workos-inc/node package
 */

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}
