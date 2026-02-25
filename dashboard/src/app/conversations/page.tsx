import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDB, getConversationThreads } from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { ConversationThreadsTable } from "@/components/dashboard/conversation-threads-table";
import { SearchInput } from "@/components/dashboard/search-input";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { ExportButton } from "@/components/dashboard/export-button";
import { Skeleton } from "@/components/ui/skeleton";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";

// Force dynamic rendering for D1 database access
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const ITEMS_PER_PAGE = 20;

export default async function ConversationsPage({ searchParams }: PageProps) {
  const { user } = await withAuth();
  if (!user) {
    redirect("/auth/login");
  }

  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : undefined;
  const escalation = params.escalation === "true";
  const page = typeof params.page === "string" ? Math.max(1, parseInt(params.page)) : 1;
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);
  const { threads, total } = await getConversationThreads(db, businessId, {
    limit: ITEMS_PER_PAGE,
    offset,
    search,
    hasEscalation: escalation || undefined,
  });

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
            <p className="text-muted-foreground">
              All customer conversations grouped by lead ({total} threads)
            </p>
          </div>
          <ExportButton type="conversations" />
        </div>
      </BlurFade>

      {/* Filters */}
      <BlurFade delay={0.1}>
        <Card>
          <CardContent className="py-4">
            <div className="flex gap-4 items-center flex-wrap">
              <Suspense fallback={<Skeleton className="h-9 w-64" />}>
                <SearchInput placeholder="Search by name or phone..." />
              </Suspense>
              <Link href={escalation ? "/conversations" : "/conversations?escalation=true"}>
                <Badge
                  variant={escalation ? "default" : "outline"}
                  className="cursor-pointer"
                >
                  Has escalation
                </Badge>
              </Link>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Conversations table */}
      <BlurFade delay={0.2}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Conversation Threads</CardTitle>
            {totalPages > 1 && (
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <ConversationThreadsTable threads={threads} />
            <Suspense fallback={null}>
              <PaginationControls currentPage={page} totalPages={totalPages} />
            </Suspense>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
