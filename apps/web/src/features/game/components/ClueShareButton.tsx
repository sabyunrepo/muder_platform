import { Share2 } from "lucide-react";
import { Button } from "@/shared/components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClueShareButtonProps {
  clueId: string;
  isShared: boolean;
  disabled?: boolean;
  onShare: (clueId: string) => void;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function ClueShareButton({ clueId, isShared, disabled, onShare }: ClueShareButtonProps) {
  if (isShared) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-amber-400">
        <Share2 className="h-4 w-4" />
        <span>공유됨</span>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={disabled}
      onClick={() => onShare(clueId)}
      className="flex items-center gap-1.5"
    >
      <Share2 className="h-3.5 w-3.5" />
      공유
    </Button>
  );
}
