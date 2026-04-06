import { useState, useEffect, useCallback } from "react";
import { Gamepad2, DoorOpen, Megaphone } from "lucide-react";
import { toast } from "sonner";
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
  type NotificationPrefs,
} from "../api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToggleItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// ToggleItem
// ---------------------------------------------------------------------------

function ToggleItem({
  icon,
  title,
  description,
  checked,
  onChange,
  disabled,
}: ToggleItemProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <span className="text-slate-400">{icon}</span>
        <div>
          <p className="text-sm font-medium text-slate-200">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
          "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-amber-500" : "bg-slate-700",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm",
            "transform transition-transform duration-150",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NotificationSettings
// ---------------------------------------------------------------------------

const ITEMS: {
  key: keyof NotificationPrefs;
  icon: React.ReactNode;
  title: string;
  description: string;
}[] = [
  {
    key: "game_invite",
    icon: <Gamepad2 className="h-5 w-5" />,
    title: "게임 초대",
    description: "다른 플레이어의 게임 초대 알림",
  },
  {
    key: "room_status",
    icon: <DoorOpen className="h-5 w-5" />,
    title: "방 상태 변경",
    description: "참여 중인 방의 상태 변경 알림",
  },
  {
    key: "marketing",
    icon: <Megaphone className="h-5 w-5" />,
    title: "혜택/이벤트",
    description: "프로모션 및 이벤트 알림",
  },
];

export function NotificationSettings() {
  const { data, isLoading, isError } = useNotificationPrefs();
  const updatePrefs = useUpdateNotificationPrefs();

  const [local, setLocal] = useState<NotificationPrefs>({
    game_invite: true,
    room_status: true,
    marketing: false,
  });

  // 서버 데이터 동기화
  useEffect(() => {
    if (data) setLocal(data);
  }, [data]);

  const handleToggle = useCallback(
    (key: keyof NotificationPrefs, value: boolean) => {
      const prev = local;
      const next = { ...local, [key]: value };

      // 낙관적 업데이트
      setLocal(next);

      updatePrefs.mutate(next, {
        onError: () => {
          setLocal(prev); // 롤백
          toast.error("알림 설정 저장에 실패했습니다.");
        },
      });
    },
    [local, updatePrefs],
  );

  if (isError) {
    return (
      <p className="text-xs text-red-400">
        알림 설정을 불러올 수 없습니다.
      </p>
    );
  }

  const isBusy = isLoading || updatePrefs.isPending;

  return (
    <div className="divide-y divide-slate-800">
      {ITEMS.map((item) => (
        <ToggleItem
          key={item.key}
          icon={item.icon}
          title={item.title}
          description={item.description}
          checked={local[item.key]}
          onChange={(value) => handleToggle(item.key, value)}
          disabled={isBusy}
        />
      ))}
    </div>
  );
}
