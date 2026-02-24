import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDB, getMessageEvents } from "@/lib/db";
import { requireBusinessForPage } from "@/lib/auth-utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { ConversationsTable } from "@/components/dashboard/conversations-table";
import { SearchInput } from "@/components/dashboard/search-input";
import { FilterButtons } from "@/components/dashboard/filter-buttons";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

// Force dynamic rendering for D1 database access
export const dynamic = "force-dynamic";

const ACTION_OPTIONS = [
  { value: "show_products", label: "Show Products" },
  { value: "ask_clarification", label: "Ask Clarification" },
  { value: "answer_question", label: "Answer Question" },
  { value: "empathize", label: "Empathize" },
  { value: "greet", label: "Greet" },
  { value: "thank", label: "Thank" },
  { value: "handoff", label: "Handoff" },
];

const STATUS_OPTIONS = [
  { value: "flagged", label: "Flagged Only" },
  { value: "active", label: "Active Only" },
];

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const ITEMS_PER_PAGE = 15;

export default async function ConversationsPage({ searchParams }: PageProps) {
  // Check authentication
  const { user } = await withAuth();
  if (!user) {
    redirect("/auth/login");
  }

  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : undefined;
  const action = typeof params.action === "string" ? params.action : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const page = typeof params.page === "string" ? Math.max(1, parseInt(params.page)) : 1;
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const db = await getDB();
  const businessId = await requireBusinessForPage(db, user.id);
  const { events, total } = await getMessageEvents(db, businessId, {
    limit: ITEMS_PER_PAGE,
    offset,
    search,
    action,
    flagged: status === "flagged" ? true : status === "active" ? false : undefined,
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
              View and manage all customer conversations ({total} total)
            </p>
          </div>
        </div>
      </BlurFade>

      {/* Filters */}
      <BlurFade delay={0.1}>
        <Card>
          <CardContent className="py-4">
            <div className="flex gap-4 items-center flex-wrap">
              <Suspense fallback={<Skeleton className="h-9 w-64" />}>
                <SearchInput placeholder="Search by phone or message..." />
              </Suspense>
              <Suspense fallback={<Skeleton className="h-9 w-24" />}>
                <FilterButtons
                  paramName="action"
                  options={ACTION_OPTIONS}
                  label="Action"
                />
              </Suspense>
              <Suspense fallback={<Skeleton className="h-9 w-24" />}>
                <FilterButtons
                  paramName="status"
                  options={STATUS_OPTIONS}
                  label="Status"
                />
              </Suspense>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Conversations table */}
      <BlurFade delay={0.2}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Conversations</CardTitle>
            {totalPages > 1 && (
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <ConversationsTable events={events} />
            <Suspense fallback={null}>
              <PaginationControls currentPage={page} totalPages={totalPages} />
            </Suspense>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
