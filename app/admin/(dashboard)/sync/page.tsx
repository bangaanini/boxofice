import {
  cleanupMovieTitlesFromAdmin,
  refreshWebCacheFromAdmin,
  resumeMovieSyncJobFromAdmin,
  syncMoviesFromAdmin,
} from "@/app/admin/actions";
import {
  AdminMetricCard,
  AdminSurface,
} from "@/components/admin/admin-surface";
import { MovieSyncAutoRefresh } from "@/components/admin/movie-sync-auto-refresh";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { SyncSubmitButton } from "@/components/admin/sync-submit-button";
import { getAdminOverviewData } from "@/lib/admin-dashboard";
import {
  isActiveMovieSyncJob,
  listRecentMovieSyncJobs,
  type MovieSyncJob,
} from "@/lib/movie-sync-jobs";

export const dynamic = "force-dynamic";

type AdminSyncPageProps = {
  searchParams: Promise<{
    sync?: string;
    target?: string;
    message?: string;
    fetched?: string;
    created?: string;
    updated?: string;
    unchanged?: string;
    upserted?: string;
    skippedUnsupported?: string;
    errors?: string;
    heroBanners?: string;
    sectionCount?: string;
    fromPage?: string;
    toPage?: string;
    perPage?: string;
    homeCreated?: string;
    homeUpdated?: string;
    homeUnchanged?: string;
    homeUpserted?: string;
    homeSkippedUnsupported?: string;
    homeFetched?: string;
    homeHeroBanners?: string;
    homeSectionCount?: string;
    homeErrors?: string;
    trendingCreated?: string;
    trendingUpdated?: string;
    trendingUnchanged?: string;
    trendingUpserted?: string;
    trendingSkippedUnsupported?: string;
    trendingFetched?: string;
    trendingFromPage?: string;
    trendingToPage?: string;
    trendingErrors?: string;
    titleCleanup?: string;
    titleChanged?: string;
    titleScanned?: string;
    titleUnchanged?: string;
    webCache?: string;
    jobId?: string;
  }>;
};

const SYNC_BUTTONS = [
  {
    label: "Sync Home Sections",
    target: "home",
    description: "Tarik hero banners + 25 section dari /api/filmbox/home",
  },
  {
    label: "Sync Trending Pages",
    target: "trending",
    description: "Tarik halaman /api/filmbox/trending sesuai range",
  },
  {
    label: "Sync All",
    target: "all",
    description: "Home + trending sekaligus",
  },
] as const;

function isLegacySyncStatus(value: string | undefined) {
  return value === "ok" || value === "partial" || value === "error";
}

function HomeSyncBanner({
  params,
}: {
  params: Awaited<AdminSyncPageProps["searchParams"]>;
}) {
  if (!isLegacySyncStatus(params.sync) || params.target !== "home") {
    return null;
  }

  return (
    <AdminSurface className="text-sm leading-6 text-neutral-200">
      {params.sync === "error" ? (
        <span className="text-red-200">
          Sync home gagal: {params.message ?? "upstream tidak merespons"}
        </span>
      ) : (
        <div className="space-y-3">
          <p className="font-semibold text-white">
            Sync home {params.sync === "partial" ? "selesai sebagian." : "selesai."}
          </p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <span className="rounded-md bg-black/30 px-3 py-2">
              Hero banners: <strong>{params.heroBanners ?? "0"}</strong>
            </span>
            <span className="rounded-md bg-black/30 px-3 py-2">
              Section: <strong>{params.sectionCount ?? "0"}</strong>
            </span>
            <span className="rounded-md bg-black/30 px-3 py-2">
              Film baru: <strong>{params.created ?? "0"}</strong>
            </span>
            <span className="rounded-md bg-black/30 px-3 py-2">
              Diperbarui: <strong>{params.updated ?? "0"}</strong>
            </span>
          </div>
          <p className="text-xs leading-5 text-neutral-400">
            Fetched: {params.fetched ?? "0"} · Tetap:{" "}
            {params.unchanged ?? "0"} · Unsupported:{" "}
            {params.skippedUnsupported ?? "0"} · Error: {params.errors ?? "0"}
          </p>
        </div>
      )}
    </AdminSurface>
  );
}

function TrendingSyncBanner({
  params,
}: {
  params: Awaited<AdminSyncPageProps["searchParams"]>;
}) {
  if (!isLegacySyncStatus(params.sync) || params.target !== "trending") {
    return null;
  }

  return (
    <AdminSurface className="text-sm leading-6 text-neutral-200">
      {params.sync === "error" ? (
        <span className="text-red-200">
          Sync trending gagal: {params.message ?? "upstream tidak merespons"}
        </span>
      ) : (
        <div className="space-y-3">
          <p className="font-semibold text-white">
            Sync trending halaman {params.fromPage ?? "0"} sampai{" "}
            {params.toPage ?? params.fromPage ?? "0"}{" "}
            {params.sync === "partial" ? "selesai sebagian." : "selesai."}
          </p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <span className="rounded-md bg-black/30 px-3 py-2">
              Film baru: <strong>{params.created ?? "0"}</strong>
            </span>
            <span className="rounded-md bg-black/30 px-3 py-2">
              Diperbarui: <strong>{params.updated ?? "0"}</strong>
            </span>
            <span className="rounded-md bg-black/30 px-3 py-2">
              Tetap: <strong>{params.unchanged ?? "0"}</strong>
            </span>
            <span className="rounded-md bg-black/30 px-3 py-2">
              Per page: <strong>{params.perPage ?? "18"}</strong>
            </span>
          </div>
          <p className="text-xs leading-5 text-neutral-400">
            Fetched: {params.fetched ?? "0"} · Unsupported:{" "}
            {params.skippedUnsupported ?? "0"} · Error: {params.errors ?? "0"}
          </p>
        </div>
      )}
    </AdminSurface>
  );
}

function AllSyncBanner({
  params,
}: {
  params: Awaited<AdminSyncPageProps["searchParams"]>;
}) {
  if (!isLegacySyncStatus(params.sync) || params.target !== "all") {
    return null;
  }

  return (
    <AdminSurface className="text-sm leading-6 text-neutral-200">
      {params.sync === "error" ? (
        <span className="text-red-200">
          Sync all gagal: {params.message ?? "upstream tidak merespons"}
        </span>
      ) : (
        <div className="space-y-3">
          <p className="font-semibold text-white">
            Sync home + trending {params.sync === "partial" ? "selesai sebagian." : "selesai."}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Home</p>
              <p className="mt-2 text-xs leading-6 text-neutral-300">
                Baru: <strong>{params.homeCreated ?? "0"}</strong> · Update:{" "}
                <strong>{params.homeUpdated ?? "0"}</strong> · Tetap:{" "}
                <strong>{params.homeUnchanged ?? "0"}</strong>
              </p>
              <p className="text-xs leading-6 text-neutral-400">
                Hero: {params.homeHeroBanners ?? "0"} · Section:{" "}
                {params.homeSectionCount ?? "0"} · Fetched:{" "}
                {params.homeFetched ?? "0"} · Error: {params.homeErrors ?? "0"}
              </p>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Trending</p>
              <p className="mt-2 text-xs leading-6 text-neutral-300">
                Baru: <strong>{params.trendingCreated ?? "0"}</strong> · Update:{" "}
                <strong>{params.trendingUpdated ?? "0"}</strong> · Tetap:{" "}
                <strong>{params.trendingUnchanged ?? "0"}</strong>
              </p>
              <p className="text-xs leading-6 text-neutral-400">
                Pages: {params.trendingFromPage ?? "0"}–
                {params.trendingToPage ?? "0"} · Fetched:{" "}
                {params.trendingFetched ?? "0"} · Error:{" "}
                {params.trendingErrors ?? "0"}
              </p>
            </div>
          </div>
        </div>
      )}
    </AdminSurface>
  );
}

function TitleCleanupBanner({
  params,
}: {
  params: Awaited<AdminSyncPageProps["searchParams"]>;
}) {
  if (!params.titleCleanup) {
    return null;
  }

  return (
    <AdminSurface className="text-sm leading-6 text-neutral-200">
      {params.titleCleanup === "error" ? (
        <span className="text-red-200">
          Bersihkan judul gagal: {params.message ?? "terjadi kesalahan"}
        </span>
      ) : (
        <div className="space-y-2">
          <p className="font-semibold text-white">Judul film selesai dirapikan.</p>
          <p className="text-xs leading-5 text-neutral-400">
            Dipindai: {params.titleScanned ?? "0"} · Diubah:{" "}
            {params.titleChanged ?? "0"} · Sudah rapi:{" "}
            {params.titleUnchanged ?? "0"}.
          </p>
        </div>
      )}
    </AdminSurface>
  );
}

function WebCacheBanner({
  params,
}: {
  params: Awaited<AdminSyncPageProps["searchParams"]>;
}) {
  if (!params.webCache) {
    return null;
  }

  return (
    <AdminSurface className="text-sm leading-6 text-neutral-200">
      {params.webCache === "error" ? (
        <span className="text-red-200">
          Refresh cache web gagal: {params.message ?? "terjadi kesalahan"}
        </span>
      ) : (
        <span className="text-emerald-100">
          {params.message ??
            "Cache web berhasil direfresh. Halaman user akan mengikuti data terbaru setelah reload berikutnya."}
        </span>
      )}
    </AdminSurface>
  );
}

function BackgroundSyncNotice({
  params,
}: {
  params: Awaited<AdminSyncPageProps["searchParams"]>;
}) {
  if (params.sync === "queued") {
    return (
      <AdminSurface className="text-sm leading-6 text-emerald-100">
        Job sync sudah masuk antrean background
        {params.jobId ? (
          <>
            {" "}
            <span className="font-mono text-emerald-200">
              #{params.jobId.slice(0, 8)}
            </span>
          </>
        ) : null}
        . Halaman ini akan refresh otomatis selama job masih berjalan.
      </AdminSurface>
    );
  }

  if (params.sync === "resumed") {
    return (
      <AdminSurface className="text-sm leading-6 text-emerald-100">
        Runner sync dipicu ulang. Progress akan lanjut dari batch terakhir yang
        tersimpan.
      </AdminSurface>
    );
  }

  if (params.sync === "error" && !params.target) {
    return (
      <AdminSurface className="text-sm leading-6 text-red-200">
        {params.message ?? "Job sync gagal diproses."}
      </AdminSurface>
    );
  }

  return null;
}

function formatJobDate(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getJobProgress(job: MovieSyncJob) {
  const processed = job.processedHomeMovies + job.processedTrendingMovies;
  const knownTotal =
    (job.totalHomeMovies ?? 0) + (job.totalTrendingMovies ?? 0);
  const total = knownTotal > 0 ? knownTotal : null;
  const percent = total
    ? Math.min(100, Math.round((processed / total) * 100))
    : job.status === "queued"
      ? 0
      : null;

  return { processed, total, percent };
}

const JOB_STATUS_LABELS: Record<MovieSyncJob["status"], string> = {
  queued: "Antre",
  running: "Berjalan",
  succeeded: "Selesai",
  partial: "Selesai sebagian",
  failed: "Gagal",
};

const JOB_STATUS_CLASSES: Record<MovieSyncJob["status"], string> = {
  queued: "border-sky-300/20 bg-sky-500/10 text-sky-100",
  running: "border-orange-300/20 bg-orange-500/10 text-orange-100",
  succeeded: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
  partial: "border-yellow-300/20 bg-yellow-500/10 text-yellow-100",
  failed: "border-red-300/20 bg-red-500/10 text-red-100",
};

function MovieSyncJobsPanel({ jobs }: { jobs: MovieSyncJob[] }) {
  const hasActiveJob = jobs.some(isActiveMovieSyncJob);

  return (
    <AdminSurface>
      <MovieSyncAutoRefresh active={hasActiveJob} />
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-orange-200">
            Background jobs
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Progress sync film
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Tiap job diproses per batch kecil agar request Next tidak menunggu
            seluruh katalog selesai.
          </p>
        </div>
        {hasActiveJob ? (
          <span className="rounded-full border border-orange-300/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-100">
            Auto-refresh aktif
          </span>
        ) : null}
      </div>

      {jobs.length ? (
        <div className="mt-5 space-y-3">
          {jobs.map((job) => {
            const progress = getJobProgress(job);
            const active = isActiveMovieSyncJob(job);

            return (
              <div
                key={job.id}
                className="rounded-[18px] border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${JOB_STATUS_CLASSES[job.status]}`}
                      >
                        {JOB_STATUS_LABELS[job.status]}
                      </span>
                      <span className="font-mono text-xs text-neutral-500">
                        #{job.id.slice(0, 8)}
                      </span>
                      <span className="text-xs uppercase text-neutral-500">
                        {job.target}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-neutral-300">
                      Phase: <strong>{job.currentPhase}</strong>
                      {job.currentPhase === "trending" ? (
                        <>
                          {" "}
                          · Page: <strong>{job.currentPage}</strong>/
                          {job.toPage}
                        </>
                      ) : null}
                      {" "}
                      · Offset: <strong>{job.currentOffset}</strong>
                    </p>
                    <p className="text-xs leading-5 text-neutral-500">
                      Dibuat: {formatJobDate(job.createdAt)} · Update:{" "}
                      {formatJobDate(job.updatedAt)}
                    </p>
                  </div>

                  {active ? (
                    <form action={resumeMovieSyncJobFromAdmin}>
                      <input type="hidden" name="redirectTo" value="/admin/sync" />
                      <input type="hidden" name="jobId" value={job.id} />
                      <PendingSubmitButton
                        pendingLabel="Memicu..."
                        variant="secondary"
                        className="h-10 border border-white/10 bg-white/10 text-white hover:bg-white/15"
                      >
                        Lanjutkan runner
                      </PendingSubmitButton>
                    </form>
                  ) : (
                    <span className="text-xs text-neutral-500">
                      Selesai: {formatJobDate(job.finishedAt)}
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-orange-300 transition-all"
                      style={{
                        width: `${progress.percent ?? (active ? 45 : 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-neutral-400">
                    Diproses: {progress.processed}
                    {progress.total ? ` / ${progress.total}` : ""} · Baru:{" "}
                    {job.created} · Update: {job.updated} · Tetap:{" "}
                    {job.unchanged} · Unsupported: {job.skippedUnsupported} ·
                    Error: {job.errorCount}
                  </p>
                </div>

                {job.messages.length ? (
                  <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100">
                    {job.messages[job.messages.length - 1]}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 text-sm text-neutral-500">
          Belum ada job sync background.
        </p>
      )}
    </AdminSurface>
  );
}

export default async function AdminSyncPage({
  searchParams,
}: AdminSyncPageProps) {
  const [params, overview, syncJobs] = await Promise.all([
    searchParams,
    getAdminOverviewData(),
    listRecentMovieSyncJobs(),
  ]);

  return (
    <div className="space-y-6">
      <AdminSurface>
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/15 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
          Sinkronisasi katalog
        </p>
        <h1 className="mt-4 text-4xl font-black text-white">Menu sync Filmbox</h1>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-neutral-400">
          Tarik data dari{" "}
          <span className="font-mono text-orange-200">/api/filmbox/home</span>{" "}
          (banner + sections homepage) atau{" "}
          <span className="font-mono text-orange-200">/api/filmbox/trending</span>{" "}
          (paginated). Custom player tetap kepakai karena getplay return MP4
          langsung + subtitle Indonesia.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          <AdminMetricCard label="Total film" value={overview.totalMovies} />
          <AdminMetricCard label="Film (movie)" value={overview.movieCount} />
          <AdminMetricCard label="Series" value={overview.seriesCount} />
          <AdminMetricCard
            label="Hero banners"
            value={overview.inHeroCount}
          />
          <AdminMetricCard
            label="Subtitle Indonesia"
            value={overview.indonesianSubtitleCount}
          />
        </div>
      </AdminSurface>

      <HomeSyncBanner params={params} />
      <TrendingSyncBanner params={params} />
      <AllSyncBanner params={params} />
      <BackgroundSyncNotice params={params} />
      <MovieSyncJobsPanel jobs={syncJobs} />
      <TitleCleanupBanner params={params} />
      <WebCacheBanner params={params} />

      <AdminSurface>
        <p className="text-sm font-semibold text-orange-200">Sinkronisasi feed</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Tarik data Filmbox</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
          Untuk trending, isi range halaman (Filmbox mulai dari 0). Sync home
          tidak butuh page karena tarik banner + semua sections sekali jalan.
        </p>

        <form action={syncMoviesFromAdmin} className="mt-5 space-y-4">
          <input type="hidden" name="redirectTo" value="/admin/sync" />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Page mulai (trending)
              </label>
              <input
                name="fromPage"
                type="number"
                min={0}
                defaultValue={params.fromPage ?? "0"}
                className="mt-2 h-12 w-full rounded-[18px] border border-white/10 bg-black/25 px-3 text-base text-white outline-none focus:border-orange-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Page akhir (trending)
              </label>
              <input
                name="toPage"
                type="number"
                min={0}
                defaultValue={params.toPage ?? "0"}
                className="mt-2 h-12 w-full rounded-[18px] border border-white/10 bg-black/25 px-3 text-base text-white outline-none focus:border-orange-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300">
                Per page
              </label>
              <input
                name="perPage"
                type="number"
                min={1}
                max={60}
                defaultValue={params.perPage ?? "18"}
                className="mt-2 h-12 w-full rounded-[18px] border border-white/10 bg-black/25 px-3 text-base text-white outline-none focus:border-orange-300"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {SYNC_BUTTONS.map((item) => (
              <div key={item.target} className="space-y-1">
                <SyncSubmitButton label={item.label} target={item.target} />
                <p className="text-xs text-neutral-500">{item.description}</p>
              </div>
            ))}
          </div>
        </form>
      </AdminSurface>

      <AdminSurface>
        <p className="text-sm font-semibold text-orange-200">Perapihan judul</p>
        <h2 className="mt-2 text-2xl font-bold text-white">Bersihkan judul</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          Rapikan judul hasil sync agar tidak membawa embel-embel SEO dari sumber
          upstream.
        </p>
        <form action={cleanupMovieTitlesFromAdmin} className="mt-4">
          <input type="hidden" name="redirectTo" value="/admin/sync" />
          <PendingSubmitButton
            pendingLabel="Membersihkan..."
            variant="secondary"
            className="h-11 border border-white/10 bg-white/10 text-white hover:bg-white/15"
          >
            Bersihkan judul
          </PendingSubmitButton>
        </form>
        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-sm font-semibold text-orange-200">Refresh web</p>
          <h3 className="mt-2 text-xl font-bold text-white">
            Paksa refresh cache
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Sesudah sync, tombol ini akan memaksa route utama (home, browse,
            detail, search) mengambil data terbaru lebih cepat.
          </p>
          <form action={refreshWebCacheFromAdmin} className="mt-4">
            <input type="hidden" name="redirectTo" value="/admin/sync" />
            <PendingSubmitButton
              pendingLabel="Merefresh..."
              variant="secondary"
              className="h-11 border border-white/10 bg-white/10 text-white hover:bg-white/15"
            >
              Refresh cache web
            </PendingSubmitButton>
          </form>
        </div>
      </AdminSurface>
    </div>
  );
}
