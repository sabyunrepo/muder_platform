import { Outlet } from "react-router";
import { Nav } from "@/shared/components/Nav";
import { Sidebar } from "@/shared/components/Sidebar";

// ---------------------------------------------------------------------------
// 인증된 유저용 메인 레이아웃 (Nav + Sidebar + Outlet)
// ---------------------------------------------------------------------------

export function MainLayout() {
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
