import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Flame, Thermometer, CheckCircle } from "lucide-react";
import { getDB, getLeads } from "@/lib/db";
import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { LeadsTable } from "@/components/dashboard/leads-table";
import { SearchInput } from "@/components/dashboard/search-input";
import { FilterButtons } from "@/components/dashboard/filter-buttons";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";

// Force dynamic rendering for D1 database access
export const dynamic = "force-dynamic";

// Default business ID for demo
const BUSINESS_ID = "demo-store-001";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "engaged", label: "Engaged" },
  { value: "warm", label: "Warm" },
  { value: "hot", label: "Hot" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
];

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const ITEMS_PER_PAGE = 15;

export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const page = typeof params.page === "string" ? Math.max(1, parseInt(params.page)) : 1;
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const db = await getDB();
  const { leads, total } = await getLeads(db, BUSINESS_ID, {
    limit: ITEMS_PER_PAGE,
    offset,
    search,
    status,
  });

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Calculate stats from actual leads
  const stats = {
    total: leads.length,
    hot: leads.filter((l) => l.status === "hot").length,
    warm: leads.filter((l) => l.status === "warm").length,
    converted: leads.filter((l) => l.status === "converted").length,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
            <p className="text-muted-foreground">
              Manage and track your customer leads ({total} total)
            </p>
          </div>
        </div>
      </BlurFade>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <BlurFade delay={0.05}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    <NumberTicker value={stats.total} />
                  </div>
                  <p className="text-xs text-muted-foreground">Total Leads</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </BlurFade>

        <BlurFade delay={0.1}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-chart-4">
                    <NumberTicker value={stats.hot} />
                  </div>
                  <p className="text-xs text-muted-foreground">Hot Leads</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <Flame className="h-5 w-5 text-chart-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        </BlurFade>

        <BlurFade delay={0.15}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-chart-3">
                    <NumberTicker value={stats.warm} />
                  </div>
                  <p className="text-xs text-muted-foreground">Warm Leads</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                  <Thermometer className="h-5 w-5 text-chart-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        </BlurFade>

        <BlurFade delay={0.2}>
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-chart-2">
                    <NumberTicker value={stats.converted} />
                  </div>
                  <p className="text-xs text-muted-foreground">Converted</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-chart-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </BlurFade>
      </div>

      {/* Filters */}
      <BlurFade delay={0.25}>
        <Card>
          <CardContent className="py-4">
            <div className="flex gap-4 items-center flex-wrap">
              <Suspense fallback={<Skeleton className="h-9 w-64" />}>
                <SearchInput placeholder="Search by name or phone..." />
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

      {/* Leads table */}
      <BlurFade delay={0.3}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">All Leads</CardTitle>
            {totalPages > 1 && (
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <LeadsTable leads={leads} />
            <Suspense fallback={null}>
              <PaginationControls currentPage={page} totalPages={totalPages} />
            </Suspense>
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
