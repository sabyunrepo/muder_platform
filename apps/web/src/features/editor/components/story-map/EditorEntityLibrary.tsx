import {
  Clapperboard,
  FileText,
  KeyRound,
  MapPin,
  MessageSquare,
  Search,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  useEditorCharacters,
  useEditorClues,
  useEditorLocations,
  type ClueResponse,
  type EditorCharacterResponse,
  type LocationResponse,
} from "@/features/editor/api";
import { useMediaList, type MediaResponse } from "@/features/editor/mediaApi";

export type StoryLibraryEntityKind =
  | "character"
  | "clue"
  | "location"
  | "media"
  | "investigationToken"
  | "discussionRoom"
  | "trigger";

export interface StoryLibraryEntity {
  id: string;
  kind: StoryLibraryEntityKind;
  title: string;
  detail: string;
  section: string;
  connectable: boolean;
}

interface EditorEntityLibraryProps {
  themeId: string;
  selectedEntity?: StoryLibraryEntity | null;
  onSelectEntity: (entity: StoryLibraryEntity) => void;
}

interface LibrarySection {
  key: string;
  title: string;
  icon: LucideIcon;
  status: string;
  entities: StoryLibraryEntity[];
  isLoading?: boolean;
  isError?: boolean;
}

function mapCharacters(characters: EditorCharacterResponse[] = []): StoryLibraryEntity[] {
  return characters.map((character) => ({
    id: character.id,
    kind: "character",
    title: character.name,
    detail: character.is_playable ? "플레이어 캐릭터" : "NPC 캐릭터",
    section: "등장인물",
    connectable: true,
  }));
}

function mapClues(clues: ClueResponse[] = []): StoryLibraryEntity[] {
  return clues.map((clue) => ({
    id: clue.id,
    kind: "clue",
    title: clue.name,
    detail: clue.location_id ? "장소 단서" : "공통 단서",
    section: "단서",
    connectable: true,
  }));
}

function mapLocations(locations: LocationResponse[] = []): StoryLibraryEntity[] {
  return locations.map((location) => ({
    id: location.id,
    kind: "location",
    title: location.name,
    detail:
      location.from_round != null || location.until_round != null
        ? "공개 구간 있음"
        : "상시 사용 가능",
    section: "장소",
    connectable: true,
  }));
}

function mapMedia(mediaList: MediaResponse[] = []): StoryLibraryEntity[] {
  return mediaList.map((media) => ({
    id: media.id,
    kind: "media",
    title: media.name,
    detail: media.type,
    section: "미디어",
    connectable: true,
  }));
}

const PROGRESSION_ENTITIES: StoryLibraryEntity[] = [
  {
    id: "investigation-token",
    kind: "investigationToken",
    title: "조사권",
    detail: "조사 횟수와 소비 기준",
    section: "진행 자원",
    connectable: true,
  },
  {
    id: "discussion-room",
    kind: "discussionRoom",
    title: "토론방",
    detail: "장면별 대화 공간",
    section: "진행 자원",
    connectable: true,
  },
  {
    id: "trigger",
    kind: "trigger",
    title: "트리거",
    detail: "조건을 만족하면 실행",
    section: "진행 자원",
    connectable: true,
  },
];

function EntityButton({
  entity,
  icon: Icon,
  isSelected,
  onSelect,
}: {
  entity: StoryLibraryEntity;
  icon: LucideIcon;
  isSelected: boolean;
  onSelect: (entity: StoryLibraryEntity) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => onSelect(entity)}
      className={`w-full rounded-md border px-3 py-2 text-left transition ${
        isSelected
          ? "border-amber-500 bg-amber-500/10 text-amber-100"
          : "border-slate-800 bg-slate-950 text-slate-200 hover:border-slate-700 hover:bg-slate-900"
      }`}
    >
      <span className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{entity.title}</span>
          <span className="mt-1 block truncate text-xs text-slate-400">{entity.detail}</span>
        </span>
      </span>
    </button>
  );
}

function LibrarySectionPanel({
  section,
  selectedEntity,
  onSelectEntity,
}: {
  section: LibrarySection;
  selectedEntity?: StoryLibraryEntity | null;
  onSelectEntity: (entity: StoryLibraryEntity) => void;
}) {
  const Icon = section.icon;
  return (
    <div className="min-w-[16rem] rounded-md border border-slate-800 bg-slate-900/70 p-3 sm:min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
          <Icon className="h-4 w-4 text-amber-400" />
          {section.title}
        </div>
        <span className="rounded-sm border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-400">
          {section.status}
        </span>
      </div>

      <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0">
        {section.isLoading && (
          <p className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
            목록을 불러오는 중입니다.
          </p>
        )}
        {section.isError && (
          <p className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-200">
            목록을 불러오지 못했습니다.
          </p>
        )}
        {!section.isLoading && !section.isError && section.entities.length === 0 && (
          <p className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
            아직 등록된 항목이 없습니다.
          </p>
        )}
        {section.entities.map((entity) => (
          <EntityButton
            key={`${entity.kind}:${entity.id}`}
            entity={entity}
            icon={Icon}
            isSelected={selectedEntity?.kind === entity.kind && selectedEntity.id === entity.id}
            onSelect={onSelectEntity}
          />
        ))}
      </div>
    </div>
  );
}

export function EditorEntityLibrary({
  themeId,
  selectedEntity,
  onSelectEntity,
}: EditorEntityLibraryProps) {
  const charactersQuery = useEditorCharacters(themeId);
  const cluesQuery = useEditorClues(themeId);
  const locationsQuery = useEditorLocations(themeId);
  const mediaQuery = useMediaList(themeId);

  const sections: LibrarySection[] = [
    {
      key: "characters",
      title: "등장인물",
      icon: Users,
      status: `${charactersQuery.data?.length ?? 0}명`,
      entities: mapCharacters(charactersQuery.data),
      isLoading: charactersQuery.isLoading,
      isError: charactersQuery.isError,
    },
    {
      key: "clues",
      title: "단서",
      icon: Search,
      status: `${cluesQuery.data?.length ?? 0}개`,
      entities: mapClues(cluesQuery.data),
      isLoading: cluesQuery.isLoading,
      isError: cluesQuery.isError,
    },
    {
      key: "locations",
      title: "장소",
      icon: MapPin,
      status: `${locationsQuery.data?.length ?? 0}곳`,
      entities: mapLocations(locationsQuery.data),
      isLoading: locationsQuery.isLoading,
      isError: locationsQuery.isError,
    },
    {
      key: "media",
      title: "미디어",
      icon: Clapperboard,
      status: `${mediaQuery.data?.length ?? 0}개`,
      entities: mapMedia(mediaQuery.data),
      isLoading: mediaQuery.isLoading,
      isError: mediaQuery.isError,
    },
    {
      key: "progression",
      title: "진행 자원",
      icon: Zap,
      status: `${PROGRESSION_ENTITIES.length}종`,
      entities: PROGRESSION_ENTITIES,
    },
  ];

  return (
    <aside className="border-b border-slate-800 bg-slate-950 lg:min-h-0 lg:w-68 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <FileText className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-100">제작 라이브러리</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto p-4 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible lg:block lg:space-y-3 [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => (
          <LibrarySectionPanel
            key={section.key}
            section={section}
            selectedEntity={selectedEntity}
            onSelectEntity={onSelectEntity}
          />
        ))}
      </div>
    </aside>
  );
}
