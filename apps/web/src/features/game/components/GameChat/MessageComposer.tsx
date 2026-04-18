import { Send } from "lucide-react";
import { Button, Input } from "@/shared/components/ui";
import type { TabType } from "./types";

interface MessageComposerProps {
  activeTab: TabType;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  disabled: boolean;
}

const PLACEHOLDERS: Record<TabType, string> = {
  all: "메시지를 입력하세요...",
  whisper: "귓속말을 입력하세요...",
  group: "그룹 메시지를 입력하세요...",
};

export function MessageComposer({
  activeTab,
  value,
  onChange,
  onKeyDown,
  onSend,
  disabled,
}: MessageComposerProps) {
  return (
    <div className="flex items-center gap-2 border-t border-slate-800 p-3">
      <div className="flex-1">
        <Input
          placeholder={PLACEHOLDERS[activeTab]}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <Button
        variant="primary"
        size="md"
        onClick={onSend}
        disabled={disabled}
        aria-label="메시지 전송"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
