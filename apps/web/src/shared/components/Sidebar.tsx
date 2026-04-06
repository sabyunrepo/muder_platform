import { NavLink } from "react-router";
import {
  Gamepad2,
  PenTool,
  Shield,
  X,
  Coins,
  Library,
  LayoutDashboard,
  Wallet,
  FileText,
  Package,
  BadgeDollarSign,
  BarChart3,
  CircleDollarSign,
  MessageCircle,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useSocialStore, selectTotalUnread } from "@/stores/socialStore";

// ---------------------------------------------------------------------------
// 사이드바 메뉴 항목 타입
// ---------------------------------------------------------------------------

interface MenuItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Array<"user" | "creator" | "admin">;
}

interface MenuSection {
  title?: string;
  roles?: Array<"user" | "creator" | "admin">;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    items: [
      { to: "/lobby", label: "로비", icon: Gamepad2 },
      { to: "/social", label: "소셜", icon: MessageCircle },
      { to: "/shop", label: "상점", icon: Coins },
      { to: "/my-themes", label: "내 테마", icon: Library },
    ],
  },
  {
    items: [
      {
        to: "/editor",
        label: "에디터",
        icon: PenTool,
        roles: ["creator", "admin"],
      },
    ],
  },
  {
    title: "제작자",
    roles: ["creator", "admin"],
    items: [
      { to: "/creator", label: "대시보드", icon: LayoutDashboard },
      { to: "/creator/earnings", label: "수익", icon: Wallet },
      { to: "/creator/settlements", label: "정산", icon: FileText },
    ],
  },
  {
    title: "관리자",
    roles: ["admin"],
    items: [
      { to: "/admin", label: "관리자 홈", icon: Shield },
      { to: "/admin/settlements", label: "정산 관리", icon: BadgeDollarSign },
      { to: "/admin/revenue", label: "매출", icon: BarChart3 },
      { to: "/admin/packages", label: "패키지", icon: Package },
      { to: "/admin/coins", label: "코인 지급", icon: CircleDollarSign },
    ],
  },
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
  const totalUnread = useSocialStore(selectTotalUnread);

  const userRole = user?.role ?? "user";

  // 역할 기반 섹션 필터링
  const visibleSections = menuSections
    .filter((section) => !section.roles || section.roles.includes(userRole))
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.roles || item.roles.includes(userRole),
      ),
    }))
    .filter((section) => section.items.length > 0);

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
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {visibleSections.map((section, idx) => (
            <div key={section.title ?? idx}>
              {idx > 0 && (
                <hr className="my-3 border-slate-800" />
              )}
              {section.title && (
                <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={navLinkClass}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                    {item.to === "/social" && totalUnread > 0 && (
                      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-slate-900">
                        {totalUnread > 99 ? "99+" : totalUnread}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
