import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { TweaksPanel } from "@/components/tweaks-panel";
import { getShellSummary } from "@/lib/supabase/queries";

// Every page here is the signed-in athlete's live data, rendered per
// request. Without this, a build with DEV_AUTH_BYPASS (no cookies read)
// tries to prerender them and fails on the Supabase no-store fetches.
export const dynamic = "force-dynamic";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const summary = await getShellSummary();
  return (
    <div className="app">
      <Sidebar summary={summary} />
      <div className="main">
        <Topbar />
        {children}
      </div>
      <TweaksPanel />
    </div>
  );
}
