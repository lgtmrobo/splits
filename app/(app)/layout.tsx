import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { TweaksPanel } from "@/components/tweaks-panel";
import { getShellSummary } from "@/lib/supabase/queries";

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
