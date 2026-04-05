import { FileText, MapPin, Clock } from "lucide-react";

import { Button, Badge, Modal } from "@/shared/components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 단서 카테고리 → Badge variant 매핑 */
const CATEGORY_MAP = {
  physical: { label: "물증", variant: "info" as const },
  testimony: { label: "증언", variant: "success" as const },
  document: { label: "문서", variant: "warning" as const },
} as const;

type ClueCategory = keyof typeof CATEGORY_MAP;

export interface Clue {
  id: string;
  title: string;
  content: string;
  category: ClueCategory;
  locationName: string;
  discoveredAt: number;
  isNew: boolean;
}

interface ClueDetailProps {
  clue: Clue;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function ClueDetail({ clue, isOpen, onClose }: ClueDetailProps) {
  const categoryInfo = CATEGORY_MAP[clue.category] ?? {
    label: clue.category,
    variant: "default" as const,
  };

  const discoveredTime = new Date(clue.discoveredAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={clue.title}
      footer={
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="space-y-4">
        {/* 카테고리 Badge */}
        <Badge variant={categoryInfo.variant}>{categoryInfo.label}</Badge>

        {/* 단서 내용 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-slate-400">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">내용</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
            {clue.content}
          </p>
        </div>

        {/* 메타 정보 */}
        <div className="flex flex-wrap gap-4 border-t border-slate-800 pt-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <MapPin className="h-4 w-4" />
            <span>{clue.locationName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <Clock className="h-4 w-4" />
            <span>{discoveredTime}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
