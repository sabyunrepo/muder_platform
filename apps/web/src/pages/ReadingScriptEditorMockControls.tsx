import { type ReactNode } from "react";
import {
  FileText,
  GripVertical,
  Image,
  Mic,
  Music,
  Play,
  Sparkles,
  Trash2,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  mockCharacters,
  mockMedia,
  type AdvanceType,
  type BlockType,
  type ReadingBlock,
} from "@/features/editor/mockReadingBlocks";

const typeLabels: Record<BlockType, string> = {
  dialogue: "대사",
  image: "이미지",
  video: "영상",
  bgm: "BGM",
  gmNote: "GM 메모",
};

const typeIcons = {
  dialogue: FileText,
  image: Image,
  video: Video,
  bgm: Music,
  gmNote: Sparkles,
};

export function BlockCard({
  block,
  index,
  selected,
  onSelect,
  onDelete,
  onUpdate,
  onDragStart,
  onDrop,
}: {
  block: ReadingBlock;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<ReadingBlock>) => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const Icon = typeIcons[block.type];
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      onClick={onSelect}
      className={`rounded-md border p-3 transition ${
        selected ? "border-amber-500 bg-amber-500/10" : "border-slate-800 bg-slate-950 hover:border-slate-700"
      }`}
    >
      <div className="grid gap-3 lg:grid-cols-[2.25rem_minmax(0,1fr)_auto]">
        <div className="flex items-start gap-2 pt-2 text-slate-500">
          <GripVertical className="h-4 w-4" />
          <span className="font-mono text-xs">{index + 1}</span>
        </div>
        <BlockSummary block={block} icon={Icon} onUpdate={onUpdate} />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="pt-2 text-rose-400 hover:text-rose-300"
          aria-label="블록 삭제"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function BlockSummary({
  block,
  icon: Icon,
  onUpdate,
}: {
  block: ReadingBlock;
  icon: LucideIcon;
  onUpdate: (patch: Partial<ReadingBlock>) => void;
}) {
  if (block.type === "dialogue") {
    return (
      <div className="space-y-2">
        <div className="grid gap-2 lg:grid-cols-[8rem_minmax(0,1fr)]">
          <SpeakerSelect value={block.speaker} onChange={(speaker) => onUpdate({ speaker })} />
          <textarea
            value={block.text}
            onChange={(event) => onUpdate({ text: event.currentTarget.value })}
            className="min-h-16 w-full resize-y rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm leading-6 text-slate-100 outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
          <InlineMediaSelect icon={Mic} label="음성" placeholder="음성 추가" type="voice" value={block.voiceMediaId} onChange={(voiceMediaId) => onUpdate({ voiceMediaId })} />
          <InlineMediaSelect icon={Image} label="이미지" placeholder="이미지 추가" type="image" value={block.imageMediaId} onChange={(imageMediaId) => onUpdate({ imageMediaId })} />
          <span className="inline-flex items-center gap-2">
            <Play className="h-3.5 w-3.5 text-slate-500" />
            진행:
            <select
              value={block.advanceType}
              onChange={(event) => onUpdate({ advanceType: event.currentTarget.value as AdvanceType })}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
            >
              <option value="gm">방장 (GM)</option>
              <option value="voice">음성 자동</option>
              <option value="character">역할 지정</option>
            </select>
          </span>
          {block.advanceType === "character" && (
            <select
              value={block.advanceCharacterId ?? "char-sanghun"}
              onChange={(event) => onUpdate({ advanceCharacterId: event.currentTarget.value })}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
            >
              {mockCharacters.filter((character) => character.id !== "gm").map((character) => (
                <option key={character.id} value={character.id}>{character.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  }
  if (block.type === "image") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <BlockTypePill icon={Icon} type={block.type} />
        <MediaSelect type="image" value={block.mediaId} onChange={(mediaId) => onUpdate({ mediaId: mediaId ?? "image-mansion" })} />
        <span className="text-xs text-slate-500">미디어 관리 항목 참조 · {block.position} · {block.size} · {advanceLabel(block)}</span>
      </div>
    );
  }
  if (block.type === "video") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <BlockTypePill icon={Icon} type={block.type} />
        <MediaSelect type="video" value={block.mediaId} onChange={(mediaId) => onUpdate({ mediaId: mediaId ?? "video-cctv" })} />
        <span className="text-xs text-slate-500">미디어 관리 항목 참조 · {block.autoplay ? "자동재생" : "수동재생"} · {block.waitUntilEnd ? "종료 대기" : "즉시 진행 가능"}</span>
      </div>
    );
  }
  if (block.type === "bgm") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <BlockTypePill icon={Icon} type={block.type} />
        <MediaSelect type="bgm" value={block.mediaId} onChange={(mediaId) => onUpdate({ mediaId, mode: "loop" })} />
        <OptionSelect value={block.mode} options={["loop", "once", "stop"]} onChange={(mode) => onUpdate({ mode: mode as never })} />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BlockTypePill icon={Icon} type={block.type} />
      <input
        value={block.text}
        onChange={(event) => onUpdate({ text: event.currentTarget.value })}
        className="min-w-64 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-500"
      />
    </div>
  );
}

function BlockTypePill({ icon: Icon, type }: { icon: LucideIcon; type: BlockType }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
      <Icon className="h-3.5 w-3.5 text-amber-400" />
      {typeLabels[type]}
    </span>
  );
}

function InlineMediaSelect({
  icon: Icon,
  label,
  onChange,
  placeholder,
  type,
  value,
}: {
  icon: LucideIcon;
  label: string;
  onChange: (value: string | undefined) => void;
  placeholder: string;
  type: "image" | "video" | "bgm" | "voice";
  value?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      {label}:
      <select value={value ?? ""} onChange={(event) => onChange(event.currentTarget.value || undefined)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200">
        <option value="">{placeholder}</option>
        {mockMedia.filter((media) => media.type === type).map((media) => (
          <option key={media.id} value={media.id}>{media.name}</option>
        ))}
      </select>
    </span>
  );
}

export function Inspector({ block, onUpdate }: { block: ReadingBlock; onUpdate: (patch: Partial<ReadingBlock>) => void }) {
  if (block.type === "dialogue") {
    return (
      <>
        <Field label="화자"><SpeakerSelect value={block.speaker} onChange={(speaker) => onUpdate({ speaker })} /></Field>
        <Field label="음성"><MediaSelect type="voice" value={block.voiceMediaId} onChange={(voiceMediaId) => onUpdate({ voiceMediaId })} /></Field>
        <Field label="이미지"><MediaSelect type="image" value={block.imageMediaId} onChange={(imageMediaId) => onUpdate({ imageMediaId })} /></Field>
        <AdvanceEditor block={block} onUpdate={onUpdate} />
      </>
    );
  }
  if (block.type === "image") {
    return (
      <>
        <Field label="이미지"><MediaSelect type="image" value={block.mediaId} onChange={(mediaId) => onUpdate({ mediaId })} /></Field>
        <Field label="위치"><OptionSelect value={block.position} options={["left", "center", "right", "full"]} onChange={(position) => onUpdate({ position: position as never })} /></Field>
        <Field label="크기"><OptionSelect value={block.size} options={["small", "medium", "large"]} onChange={(size) => onUpdate({ size: size as never })} /></Field>
        <AdvanceEditor block={block} onUpdate={onUpdate} />
      </>
    );
  }
  if (block.type === "video") {
    return (
      <>
        <Field label="영상"><MediaSelect type="video" value={block.mediaId} onChange={(mediaId) => onUpdate({ mediaId })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={block.autoplay} onChange={(event) => onUpdate({ autoplay: event.currentTarget.checked })} />자동재생</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={block.waitUntilEnd} onChange={(event) => onUpdate({ waitUntilEnd: event.currentTarget.checked })} />영상 종료 후 진행</label>
        <AdvanceEditor block={block} onUpdate={onUpdate} />
      </>
    );
  }
  if (block.type === "bgm") {
    return (
      <>
        <Field label="BGM"><MediaSelect type="bgm" value={block.mediaId} onChange={(mediaId) => onUpdate({ mediaId, mode: "loop" })} /></Field>
        <Field label="재생 방식"><OptionSelect value={block.mode} options={["loop", "once", "stop"]} onChange={(mode) => onUpdate({ mode: mode as never })} /></Field>
        <p className="rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-400">반복은 다음 BGM 블록 전까지 유지되고, 1회는 한 번만 재생합니다. 섹션이 끝나면 모든 BGM은 정지됩니다.</p>
      </>
    );
  }
  return <Field label="GM 메모"><textarea value={block.text} onChange={(event) => onUpdate({ text: event.currentTarget.value })} className="h-28 w-full rounded-md border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-amber-500" /></Field>;
}

function AdvanceEditor({ block, onUpdate }: { block: Extract<ReadingBlock, { advanceType: unknown }>; onUpdate: (patch: Partial<ReadingBlock>) => void }) {
  return (
    <>
      <Field label="진행 방식">
        <OptionSelect value={block.advanceType} options={["gm", "voice", "character"].filter((option) => block.type !== "image" || option !== "voice")} onChange={(advanceType) => onUpdate({ advanceType: advanceType as AdvanceType })} />
      </Field>
      {block.advanceType === "character" && (
        <Field label="진행 캐릭터">
          <select value={block.advanceCharacterId ?? "char-sanghun"} onChange={(event) => onUpdate({ advanceCharacterId: event.currentTarget.value })} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            {mockCharacters.filter((character) => character.id !== "gm").map((character) => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
        </Field>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-xs font-medium text-slate-400"><span>{label}</span>{children}</label>;
}

function SpeakerSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.currentTarget.value)} className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-amber-500">
      <option value="나레이션">나레이션</option>
      {mockCharacters.filter((character) => character.id !== "gm").map((character) => (
        <option key={character.id} value={character.name}>{character.name}</option>
      ))}
    </select>
  );
}

function MediaSelect({ type, value, onChange }: { type: "image" | "video" | "bgm" | "voice"; value?: string; onChange: (value: string | undefined) => void }) {
  return (
    <select value={value ?? ""} onChange={(event) => onChange(event.currentTarget.value || undefined)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
      <option value="">선택 없음</option>
      {mockMedia.filter((media) => media.type === type).map((media) => (
        <option key={media.id} value={media.id}>{media.name}</option>
      ))}
    </select>
  );
}

function OptionSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.currentTarget.value)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function advanceLabel(block: Extract<ReadingBlock, { advanceType: unknown }>): string {
  if (block.advanceType === "gm") return "방장 진행";
  if (block.advanceType === "voice") return "음성 자동";
  return "캐릭터 진행";
}
