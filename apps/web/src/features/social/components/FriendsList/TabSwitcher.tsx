export type FriendsListTab = "friends" | "pending";

interface TabSwitcherProps {
  activeTab: FriendsListTab;
  onChange: (tab: FriendsListTab) => void;
  pendingCount: number;
}

export function TabSwitcher({ activeTab, onChange, pendingCount }: TabSwitcherProps) {
  return (
    <div className="flex border-b border-[var(--mmp-color-hairline)]">
      <button
        type="button"
        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
          activeTab === "friends"
            ? "border-b-2 border-[var(--mmp-color-primary)] text-[var(--mmp-color-primary)]"
            : "text-[var(--mmp-color-steel)] hover:text-[var(--mmp-color-ink)]"
        }`}
        onClick={() => onChange("friends")}
      >
        친구 목록
      </button>
      <button
        type="button"
        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
          activeTab === "pending"
            ? "border-b-2 border-[var(--mmp-color-primary)] text-[var(--mmp-color-primary)]"
            : "text-[var(--mmp-color-steel)] hover:text-[var(--mmp-color-ink)]"
        }`}
        onClick={() => onChange("pending")}
      >
        <span className="inline-flex items-center gap-1.5">
          대기 중인 요청
          {pendingCount > 0 && (
            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--mmp-color-primary)] px-1 text-xs font-bold text-[var(--mmp-color-primary-contrast)]">
              {pendingCount}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
