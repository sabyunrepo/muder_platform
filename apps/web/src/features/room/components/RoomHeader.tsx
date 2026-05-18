import { useState } from "react";
import { Copy, Check, Users } from "lucide-react";
import { Badge, Button, Panel } from "@/shared/components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoomHeaderProps {
  themeTitle: string;
  roomCode: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
}

// ---------------------------------------------------------------------------
// 상태 Badge 매핑
// ---------------------------------------------------------------------------

const statusConfig: Record<string, { label: string; variant: "warning" | "success" | "info" }> = {
  waiting: { label: "대기 중", variant: "warning" },
  playing: { label: "진행 중", variant: "success" },
};

// ---------------------------------------------------------------------------
// RoomHeader
// ---------------------------------------------------------------------------

export function RoomHeader({
  themeTitle,
  roomCode,
  playerCount,
  maxPlayers,
  status,
}: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  /** 방 코드 클립보드 복사 */
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API 미지원 환경 — 무시
    }
  };

  const { label, variant } = statusConfig[status] ?? {
    label: status,
    variant: "info" as const,
  };

  return (
    <Panel className="flex flex-wrap items-center justify-between gap-3">
      {/* 왼쪽: 테마 + 방 코드 */}
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-bold text-[var(--mmp-color-ink)]">{themeTitle}</h1>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-[var(--mmp-color-steel)]">#{roomCode}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 !p-0"
            onClick={handleCopyCode}
            aria-label="방 코드 복사"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[var(--mmp-color-success)]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* 오른쪽: 인원 + 상태 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-[var(--mmp-color-charcoal)]">
          <Users className="h-4 w-4" />
          <span>
            {playerCount}/{maxPlayers}
          </span>
        </div>
        <Badge variant={variant}>{label}</Badge>
      </div>
    </Panel>
  );
}
