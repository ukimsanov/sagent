/**
 * Authentication utilities for multi-tenant business resolution
 *
 * Links WorkOS user IDs to business accounts via user_businesses table
 */

export interface UserBusiness {
  id: string;
  workos_user_id: string;
  business_id: string;
  role: 'admin' | 'member' | 'viewer';
  created_at: number;
}

/**
 * Get the business ID for a WorkOS user
 *
 * @param db - D1 database instance
 * @param workosUserId - WorkOS user ID
 * @returns Business ID or null if user has no business (needs onboarding)
 */
export async function getUserBusinessId(
  db: D1Database,
  workosUserId: string
): Promise<string | null> {
  const result = await db
    .prepare('SELECT business_id FROM user_businesses WHERE workos_user_id = ? LIMIT 1')
    .bind(workosUserId)
    .first<{ business_id: string }>();

  return result?.business_id || null;
}

/**
 * Get the business ID for a WorkOS user, throwing if not found.
 * Use this in API routes where a business is required.
 */
export async function requireBusinessId(
  db: D1Database,
  workosUserId: string
): Promise<string> {
  const businessId = await getUserBusinessId(db, workosUserId);
  if (!businessId) {
    throw new Error('NO_BUSINESS');
  }
  return businessId;
}

/**
 * Get business ID or redirect to onboarding.
 * Use this in protected page server components.
 */
export async function requireBusinessForPage(
  db: D1Database,
  workosUserId: string
): Promise<string> {
  const businessId = await getUserBusinessId(db, workosUserId);
  if (!businessId) {
    const { redirect } = await import('next/navigation');
    return redirect('/onboarding') as never;
  }
  return businessId;
}

/**
 * Get all businesses for a WorkOS user (for future multi-business support)
 *
 * @param db - D1 database instance
 * @param workosUserId - WorkOS user ID
 * @returns Array of UserBusiness entries
 */
export async function getUserBusinesses(
  db: D1Database,
  workosUserId: string
): Promise<UserBusiness[]> {
  const result = await db
    .prepare('SELECT * FROM user_businesses WHERE workos_user_id = ? ORDER BY created_at DESC')
    .bind(workosUserId)
    .all<UserBusiness>();

  return result.results || [];
}

/**
 * Check if a user has access to a specific business
 *
 * @param db - D1 database instance
 * @param workosUserId - WorkOS user ID
 * @param businessId - Business ID to check
 * @returns True if user has access
 */
export async function userHasBusinessAccess(
  db: D1Database,
  workosUserId: string,
  businessId: string
): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM user_businesses WHERE workos_user_id = ? AND business_id = ?')
    .bind(workosUserId, businessId)
    .first();

  return result !== null;
}

/**
 * Get user's role in a specific business
 *
 * @param db - D1 database instance
 * @param workosUserId - WorkOS user ID
 * @param businessId - Business ID
 * @returns Role or null if no access
 */
export async function getUserBusinessRole(
  db: D1Database,
  workosUserId: string,
  businessId: string
): Promise<'admin' | 'member' | 'viewer' | null> {
  const result = await db
    .prepare('SELECT role FROM user_businesses WHERE workos_user_id = ? AND business_id = ?')
    .bind(workosUserId, businessId)
    .first<{ role: 'admin' | 'member' | 'viewer' }>();

  return result?.role || null;
}

/**
 * Add a user to a business (admin function)
 *
 * @param db - D1 database instance
 * @param workosUserId - WorkOS user ID
 * @param businessId - Business ID
 * @param role - User role in the business
 */
export async function addUserToBusiness(
  db: D1Database,
  workosUserId: string,
  businessId: string,
  role: 'admin' | 'member' | 'viewer' = 'admin'
): Promise<void> {
  const id = crypto.randomUUID();

  await db
    .prepare(`
      INSERT INTO user_businesses (id, workos_user_id, business_id, role, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (workos_user_id, business_id) DO UPDATE SET role = excluded.role
    `)
    .bind(id, workosUserId, businessId, role, Date.now())
    .run();
}
