import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getUserBusinessId } from "@/lib/auth-utils";
import { OnboardingWizard } from "./onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { user } = await withAuth();
  if (!user) {
    redirect("/auth/login");
  }

  // If user already has a business, skip onboarding
  const db = await getDB();
  const existingBusiness = await getUserBusinessId(db, user.id);
  if (existingBusiness) {
    redirect("/");
  }

  const firstName = user.firstName || user.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <OnboardingWizard userName={firstName} />
    </div>
  );
}
