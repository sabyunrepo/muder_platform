import { NavLink } from "react-router";
import { Gamepad2, PenTool, Shield, X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";

// ---------------------------------------------------------------------------
// 사이드바 메뉴 항목 타입
// ---------------------------------------------------------------------------

interface MenuItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Array<"user" | "creator" | "admin">;
}

const menuItems: MenuItem[] = [
  { to: "/lobby", label: "로비", icon: Gamepad2 },
  { to: "/editor", label: "에디터", icon: PenTool, roles: ["creator", "admin"] },
  { to: "/admin", label: "관리자", icon: Shield, roles: ["admin"] },
];

// ---------------------------------------------------------------------------
// NavLink 스타일 헬퍼
// ---------------------------------------------------------------------------

function navLinkClass({ isActive }: { isActive: boolean }): string {
  const base =
    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors";
  return isActive
    ? `${base} bg-slate-800 text-amber-500`
    : `${base} text-slate-400 hover:bg-slate-800 hover:text-slate-200`;
}

// ---------------------------------------------------------------------------
// 좌측 사이드바 네비게이션
// ---------------------------------------------------------------------------

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  const userRole = user?.role ?? "user";

  // 역할 기반 필터링
  const visibleItems = menuItems.filter(
    (item) => !item.roles || item.roles.includes(userRole),
  );

  return (
    <>
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSidebarOpen(false);
          }}
          role="presentation"
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed top-16 left-0 z-30 flex h-[calc(100vh-4rem)] w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* 모바일 닫기 버튼 */}
        <div className="flex items-center justify-end p-2 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="사이드바 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={navLinkClass}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
