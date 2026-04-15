import { Eye, FileText, MapPin } from "lucide-react";
import { Badge, Card } from "@/shared/components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const CATEGORY_MAP = {
  physical: { label: "물증", variant: "info" as const },
  testimony: { label: "증언", variant: "success" as const },
  document: { label: "문서", variant: "warning" as const },
} as const;

type ClueCategory = keyof typeof CATEGORY_MAP;

export interface ViewClue {
  id: string;
  title: string;
  description: string;
  category: ClueCategory | string;
  locationName?: string;
  imageUrl?: string;
  isNew?: boolean;
  isShared?: boolean;
}

interface ClueCardProps {
  clue: ViewClue;
  onClick: (clue: ViewClue) => void;
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export function ClueCard({ clue, onClick }: ClueCardProps) {
  const categoryInfo = CATEGORY_MAP[clue.category as ClueCategory] ?? {
    label: clue.category,
    variant: "default" as const,
  };

  return (
    <Card
      hoverable
      onClick={() => onClick(clue)}
      className="flex gap-3 !p-3"
    >
      {/* 이미지 썸네일 */}
      {clue.imageUrl ? (
        <img
          src={clue.imageUrl}
          alt={clue.title}
          className="h-14 w-14 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-700">
          <FileText className="h-6 w-6 text-slate-400" />
        </div>
      )}

      {/* 내용 */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          {clue.isNew && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
          )}
          <span className="truncate text-sm font-medium text-slate-200">
            {clue.title}
          </span>
        </div>

        <p className="line-clamp-2 text-xs text-slate-400">{clue.description}</p>

        <div className="flex items-center gap-2">
          <Badge variant={categoryInfo.variant}>{categoryInfo.label}</Badge>
          {clue.locationName && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3 w-3" />
              {clue.locationName}
            </span>
          )}
          {clue.isShared && (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <Eye className="h-3 w-3" />
              공유됨
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
