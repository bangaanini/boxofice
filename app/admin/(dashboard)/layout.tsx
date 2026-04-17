import Link from "next/link";
import { LogOut, Play } from "lucide-react";

import { logoutAdmin } from "@/app/admin/actions";
import { AdminActionToast } from "@/components/admin/admin-action-toast";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { PendingSubmitButton } from "@/components/admin/pending-submit-button";
import { Button } from "@/components/ui/button";
import { requireAdminSession } from "@/lib/admin-session";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminSession();

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(126,63,34,0.2),transparent_26%),linear-gradient(180deg,#130d0c_0%,#080808_58%,#040404_100%)] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="xl:sticky xl:top-6 xl:self-start">
            <AdminSidebar email={session.email} />
          </div>

          <div className="space-y-5">
            <AdminActionToast />
            <div className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(27,18,16,0.96),rgba(14,10,9,0.98))] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-orange-200">
                  Area admin terkunci
                </p>
                <p className="mt-1 text-sm text-neutral-400">
                  Semua perubahan di panel ini langsung memengaruhi katalog dan
                  sistem affiliate.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button asChild className="h-11 bg-red-600 text-white hover:bg-red-500">
                  <Link href="/">
                    <Play className="size-4 fill-current" />
                    Lihat app
                  </Link>
                </Button>
                <form action={logoutAdmin}>
                  <PendingSubmitButton
                    pendingLabel="Keluar..."
                    variant="secondary"
                    className="h-11 border border-white/10 bg-white/10 text-white hover:bg-white/15"
                  >
                    <LogOut className="size-4" />
                    Logout
                  </PendingSubmitButton>
                </form>
              </div>
            </div>

            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
