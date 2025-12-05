"use server";

import { signOut } from "@workos-inc/authkit-nextjs";

export async function signOutAction() {
  console.log("[AUTH] signOutAction called - user explicitly clicked logout");
  console.log("[AUTH] Timestamp:", new Date().toISOString());
  console.log("[AUTH] Stack trace:", new Error().stack);
  await signOut();
}
