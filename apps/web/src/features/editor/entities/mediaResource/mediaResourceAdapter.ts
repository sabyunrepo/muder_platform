import type {
  MediaResponse,
  MediaSourceType,
  MediaType,
} from "@/features/editor/mediaApi";

export type MediaResourceUseCase =
  | "phase_bgm"
  | "phase_sound_effect"
  | "role_sheet_document"
  | "role_sheet_image"
  | "story_voice"
  | "location_image"
  | "character_alias_icon"
  | "presentation_background"
  | "video_action";

export interface MediaResourceViewModel {
  id: string;
  name: string;
  type: MediaType;
  typeLabel: string;
  sourceLabel: string;
  durationLabel: string | null;
  fileSizeLabel: string | null;
  metaLabel: string;
  tags: string[];
  isExternal: boolean;
  canPreview: boolean;
  isSelectable: boolean;
  unselectableReason: string | null;
}

const TYPE_LABEL: Record<MediaType, string> = {
  BGM: "배경음악",
  SFX: "효과음",
  VOICE: "음성/내레이션",
  VIDEO: "영상",
  DOCUMENT: "문서",
  IMAGE: "이미지",
};

const SOURCE_LABEL: Record<MediaSourceType, string> = {
  FILE: "업로드 파일",
  YOUTUBE: "YouTube",
};

const USE_CASE_ALLOWED_TYPES: Record<MediaResourceUseCase, MediaType[]> = {
  phase_bgm: ["BGM"],
  phase_sound_effect: ["SFX", "VOICE"],
  role_sheet_document: ["DOCUMENT"],
  role_sheet_image: ["IMAGE"],
  story_voice: ["VOICE", "SFX"],
  location_image: [],
  character_alias_icon: ["IMAGE"],
  presentation_background: ["IMAGE"],
  video_action: ["VIDEO"],
};

const USE_CASE_EMPTY_REASON: Record<MediaResourceUseCase, string> = {
  phase_bgm: "페이즈 배경음악에는 배경음악만 선택할 수 있어요.",
  phase_sound_effect: "페이즈 효과에는 효과음 또는 음성/내레이션만 선택할 수 있어요.",
  role_sheet_document: "롤지 문서에는 PDF 같은 문서 리소스만 선택할 수 있어요.",
  role_sheet_image: "이미지 롤지에는 이미지 리소스만 선택할 수 있어요.",
  story_voice: "스토리 음성에는 음성/내레이션 또는 효과음만 선택할 수 있어요.",
  location_image:
    "장소 이미지는 현재 이미지 업로드 흐름에서 선택해요. 공통 이미지 리소스는 후속 작업에서 연결합니다.",
  character_alias_icon: "플레이 중 표시 아이콘에는 이미지 리소스만 선택할 수 있어요.",
  presentation_background: "배경 연출에는 이미지 리소스만 선택할 수 있어요.",
  video_action: "영상 액션에는 영상 리소스만 선택할 수 있어요.",
};

export function getMediaResourceTypeLabel(type: MediaType): string {
  return TYPE_LABEL[type];
}

export function getMediaResourceSourceLabel(sourceType: MediaSourceType): string {
  return SOURCE_LABEL[sourceType];
}

export function getAllowedMediaTypesForUseCase(
  useCase: MediaResourceUseCase,
): MediaType[] {
  return [...USE_CASE_ALLOWED_TYPES[useCase]];
}

export function formatMediaDuration(seconds?: number): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function formatMediaFileSize(bytes?: number): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${Math.round(bytes)}B`;
  const kib = bytes / 1024;
  const kbLabel = formatCompactNumber(kib);
  if (Number(kbLabel) < 1024) return `${kbLabel}KB`;
  return `${formatCompactNumber(kib / 1024)}MB`;
}

function formatCompactNumber(value: number): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export function isMediaSelectableForUseCase(
  media: Pick<MediaResponse, "type">,
  useCase?: MediaResourceUseCase,
): boolean {
  if (!useCase) return true;
  return USE_CASE_ALLOWED_TYPES[useCase].includes(media.type);
}

export function getMediaResourceUnselectableReason(
  media: Pick<MediaResponse, "type">,
  useCase?: MediaResourceUseCase,
): string | null {
  if (!useCase || isMediaSelectableForUseCase(media, useCase)) return null;
  return USE_CASE_EMPTY_REASON[useCase];
}

export function toMediaResourceViewModel(
  media: MediaResponse,
  options: { useCase?: MediaResourceUseCase } = {},
): MediaResourceViewModel {
  const durationLabel = formatMediaDuration(media.duration);
  const fileSizeLabel = formatMediaFileSize(media.file_size);
  const sourceLabel = getMediaResourceSourceLabel(media.source_type);
  const typeLabel = getMediaResourceTypeLabel(media.type);
  const metaParts = [typeLabel, sourceLabel, durationLabel, fileSizeLabel].filter(
    Boolean,
  );
  const isSelectable = isMediaSelectableForUseCase(media, options.useCase);

  return {
    id: media.id,
    name: media.name.trim() || "이름 없는 리소스",
    type: media.type,
    typeLabel,
    sourceLabel,
    durationLabel,
    fileSizeLabel,
    metaLabel: metaParts.join(" · "),
    tags: [...media.tags],
    isExternal: media.source_type === "YOUTUBE",
    canPreview: media.type !== "DOCUMENT" && media.source_type === "FILE",
    isSelectable,
    unselectableReason: isSelectable
      ? null
      : getMediaResourceUnselectableReason(media, options.useCase),
  };
}

export function toMediaResourceViewModels(
  media: MediaResponse[],
  options: { useCase?: MediaResourceUseCase } = {},
): MediaResourceViewModel[] {
  return media.map((item) => toMediaResourceViewModel(item, options));
}

export function filterMediaResourceViewModels(
  resources: MediaResourceViewModel[],
  query: string,
): MediaResourceViewModel[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return resources;

  return resources.filter((resource) => {
    const searchable = [
      resource.name,
      resource.typeLabel,
      resource.sourceLabel,
      resource.metaLabel,
      ...resource.tags,
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}
