import { Outlet } from "react-router";
import { Nav } from "@/shared/components/Nav";
import { Sidebar } from "@/shared/components/Sidebar";
import { useWsClient } from "@/hooks/useWsClient";
import { useSocialSync } from "@/features/social/hooks/useSocialSync";

// ---------------------------------------------------------------------------
// 인증된 유저용 메인 레이아웃 (Nav + Sidebar + Outlet)
// ---------------------------------------------------------------------------

export function MainLayout() {
  // Social WS: 인증된 모든 페이지에서 자동 ���결
  useWsClient({ endpoint: "social" });
  useSocialSync();

  return (
    <div className="min-h-screen bg-slate-950">
      <Nav />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 lg:ml-64">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
