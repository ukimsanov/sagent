import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, CheckCircle2, XCircle, FileText } from "lucide-react";
import Link from "next/link";
import { getDB, getFaqs, getFaqStats } from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { StatsCard } from "@/components/dashboard/stats-card";
import { FaqActions } from "@/components/faqs/faq-actions";
import { BlurFade } from "@/components/ui/blur-fade";

export const dynamic = "force-dynamic";

const statusConfig: Record<string, { className: string; label: string }> = {
  draft: { className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: "Draft" },
  approved: { className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Approved" },
  rejected: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Rejected" },
};

export default async function FaqsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { user } = await withAuth();
  if (!user) redirect("/auth/login");

  const sp = await searchParams;
  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);

  const statusFilter = sp.status || "all";
  const [faqs, stats] = await Promise.all([
    getFaqs(db, businessId, statusFilter !== "all" ? statusFilter : undefined),
    getFaqStats(db, businessId),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auto-Generated FAQs</h1>
          <p className="text-muted-foreground">
            AI-generated FAQ entries from recurring customer questions. Approve to use in agent responses.
          </p>
        </div>
      </BlurFade>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total FAQs"
          value={stats.total}
          description="All generated FAQs"
          iconName="help-circle"
          delay={0}
        />
        <StatsCard
          title="Draft"
          value={stats.draft}
          description="Awaiting review"
          iconName="file-text"
          delay={0.05}
        />
        <StatsCard
          title="Approved"
          value={stats.approved}
          description="Used by AI agent"
          iconName="shield-check"
          delay={0.1}
        />
        <StatsCard
          title="Rejected"
          value={stats.rejected}
          description="Not used"
          iconName="alert-circle"
          delay={0.15}
        />
      </div>

      {/* Filters */}
      <BlurFade delay={0.2}>
        <div className="flex gap-2">
          <Link href="/faqs?status=all">
            <Badge
              variant={statusFilter === "all" ? "default" : "outline"}
              className="cursor-pointer"
            >
              All
            </Badge>
          </Link>
          <Link href="/faqs?status=draft">
            <Badge
              variant={statusFilter === "draft" ? "default" : "outline"}
              className="cursor-pointer"
            >
              Draft
            </Badge>
          </Link>
          <Link href="/faqs?status=approved">
            <Badge
              variant={statusFilter === "approved" ? "default" : "outline"}
              className="cursor-pointer"
            >
              Approved
            </Badge>
          </Link>
          <Link href="/faqs?status=rejected">
            <Badge
              variant={statusFilter === "rejected" ? "default" : "outline"}
              className="cursor-pointer"
            >
              Rejected
            </Badge>
          </Link>
        </div>
      </BlurFade>

      {/* FAQ List */}
      <BlurFade delay={0.25}>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              FAQs
              <Badge variant="secondary" className="ml-1">{faqs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {faqs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="font-medium text-lg">No FAQs yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  FAQs are auto-generated weekly from recurring customer questions
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {faqs.map((faq) => {
                  const st = statusConfig[faq.status] || statusConfig.draft;
                  return (
                    <div key={faq.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">{faq.question}</p>
                            <Badge className={st.className}>{st.label}</Badge>
                            {faq.frequency > 1 && (
                              <Badge variant="outline" className="text-xs">
                                Asked {faq.frequency}x
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {faq.answer}
                          </p>
                        </div>
                        <FaqActions faqId={faq.id} currentStatus={faq.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
