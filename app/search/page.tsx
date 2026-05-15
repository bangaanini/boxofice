import { UpstreamSearch } from "@/components/search/upstream-search";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{
    blocked?: string;
    page?: string;
    q?: string;
  }>;
};

function parsePage(value: string | undefined) {
  const parsed = Number(value ?? "1");

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-black text-white">
      <UpstreamSearch
        initialBlockedNotice={params.blocked === "1"}
        initialPage={parsePage(params.page)}
        initialQuery={params.q ?? ""}
      />
    </main>
  );
}
