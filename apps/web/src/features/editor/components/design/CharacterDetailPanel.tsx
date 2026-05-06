import { useEffect, useMemo, useRef, useState } from 'react';
import { Accordion } from '@/shared/components/ui';
import type { CharacterAliasRule, MysteryRole } from '@/features/editor/api';
import type { Mission } from './MissionEditor';
import { MissionEditor } from './MissionEditor';
import { StartingClueAssigner } from './StartingClueAssigner';
import { CharacterRoleSheetSection } from './CharacterRoleSheetSection';
import { CharacterAliasRulesEditor } from './CharacterAliasRulesEditor';
import { ImageMediaReferenceField } from '@/features/editor/components/media/ImageMediaReferenceField';
import {
  type CharacterVisibilityField,
  characterRoleOptions,
  getCharacterRoleOption,
  normalizeCharacterEditorRole,
  normalizeCharacterAliasRules,
  toCharacterEditorViewModel,
} from '@/features/editor/entities/character/characterEditorAdapter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClueItem {
  id: string;
  name: string;
  location?: string;
  round?: number;
  tag?: string;
}

interface CharacterItem {
  id: string;
  theme_id?: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  image_media_id?: string | null;
  is_culprit?: boolean;
  mystery_role?: MysteryRole;
  sort_order?: number;
  is_playable?: boolean;
  show_in_intro?: boolean;
  can_speak_in_reading?: boolean;
  is_voting_candidate?: boolean;
  endcard_title?: string | null;
  endcard_body?: string | null;
  endcard_image_url?: string | null;
  endcard_image_media_id?: string | null;
  alias_rules?: CharacterAliasRule[];
}

interface CharacterDetailPanelProps {
  themeId: string;
  selectedChar: CharacterItem | null;
  characters: CharacterItem[];
  clues: ClueItem[] | undefined;
  charClueIds: string[];
  charMissions: Mission[];
  onClueToggle: (clueId: string, checked: boolean) => void;
  onAddMission: () => void;
  onChangeMission: (missionId: string, field: keyof Mission, value: string | number) => void;
  onDeleteMission: (missionId: string) => void;
  onMysteryRoleChange?: (role: MysteryRole) => void;
  onVisibilityChange?: (field: CharacterVisibilityField, value: boolean) => void;
  onAliasRulesSave?: (rules: CharacterAliasRule[]) => void;
  onEndcardChange?: (values: { title: string; body: string; imageUrl: string; imageMediaId?: string | null }) => void;
  onProfileImageChange?: (imageMediaId: string | null) => void;
}

// ---------------------------------------------------------------------------
// CharacterDetailPanel
// ---------------------------------------------------------------------------

export function CharacterDetailPanel({
  themeId,
  selectedChar,
  characters,
  clues,
  charClueIds,
  charMissions,
  onClueToggle,
  onAddMission,
  onChangeMission,
  onDeleteMission,
  onMysteryRoleChange,
  onVisibilityChange,
  onAliasRulesSave,
  onEndcardChange,
  onProfileImageChange,
}: CharacterDetailPanelProps) {
  const [aliasDrafts, setAliasDrafts] = useState<CharacterAliasRule[]>([]);
  const aliasDraftCharacterIdRef = useRef<string | null>(null);
  const [endcardTitle, setEndcardTitle] = useState('');
  const [endcardBody, setEndcardBody] = useState('');
  const [endcardImageUrl, setEndcardImageUrl] = useState('');
  const [endcardImageMediaId, setEndcardImageMediaId] = useState<string | null>(null);
  const characterOptions = useMemo(
    () => characters.map((char) => ({ id: char.id, name: char.name })),
    [characters]
  );

  useEffect(() => {
    if (aliasDraftCharacterIdRef.current === (selectedChar?.id ?? null)) return;
    aliasDraftCharacterIdRef.current = selectedChar?.id ?? null;
    setAliasDrafts(normalizeCharacterAliasRules(selectedChar?.alias_rules));
  }, [selectedChar]);

  useEffect(() => {
    setEndcardTitle(selectedChar?.endcard_title ?? '');
    setEndcardBody(selectedChar?.endcard_body ?? '');
    setEndcardImageUrl(selectedChar?.endcard_image_url ?? '');
    setEndcardImageMediaId(selectedChar?.endcard_image_media_id ?? null);
  }, [
    selectedChar?.id,
    selectedChar?.endcard_title,
    selectedChar?.endcard_body,
    selectedChar?.endcard_image_url,
    selectedChar?.endcard_image_media_id,
  ]);

  if (!selectedChar) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-slate-600">좌측에서 캐릭터를 선택하세요</p>
      </div>
    );
  }

  const selectedRole: MysteryRole = normalizeCharacterEditorRole(selectedChar);
  const selectedView = toCharacterEditorViewModel({
    id: selectedChar.id,
    theme_id: selectedChar.theme_id ?? '',
    name: selectedChar.name,
    description: selectedChar.description ?? null,
    image_url: selectedChar.image_url ?? null,
    image_media_id: selectedChar.image_media_id ?? null,
    is_culprit: Boolean(selectedChar.is_culprit),
    mystery_role: selectedRole,
    sort_order: selectedChar.sort_order ?? 0,
    is_playable: selectedChar.is_playable ?? true,
    show_in_intro: selectedChar.show_in_intro ?? true,
    can_speak_in_reading: selectedChar.can_speak_in_reading ?? true,
    is_voting_candidate:
      selectedChar.is_voting_candidate ??
      getCharacterRoleOption(selectedRole).defaultVotingCandidate,
    endcard_title: selectedChar.endcard_title ?? null,
    endcard_body: selectedChar.endcard_body ?? null,
    endcard_image_url: selectedChar.endcard_image_url ?? null,
    endcard_image_media_id: selectedChar.endcard_image_media_id ?? null,
    alias_rules: selectedChar.alias_rules ?? [],
  });
  const endcardDirty =
    endcardTitle !== (selectedChar.endcard_title ?? '') ||
    endcardBody !== (selectedChar.endcard_body ?? '') ||
    endcardImageUrl !== (selectedChar.endcard_image_url ?? '') ||
    endcardImageMediaId !== (selectedChar.endcard_image_media_id ?? null);

  return (
    <div className="max-w-4xl space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-200">{selectedChar.name}</h3>
          <p className="mt-1 text-xs text-slate-500">역할지, 시작 단서, 히든 미션을 한 곳에서 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label={`${selectedChar.name} 요약`}>
          {[selectedView.roleLabel, ...selectedView.visibilityBadges].map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] font-medium text-slate-300"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      <Accordion
        storageKey={`editor:character:${selectedChar.id}:sections:v2`}
        items={[
          {
            id: 'base',
            title: '기본 정보',
            subtitle: `${selectedView.roleLabel} · ${selectedView.characterTypeLabel}`,
            defaultOpen: true,
            forceOpen: true,
            children: (
              <div className="grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)]">
                <div className="min-w-0">
                  {onProfileImageChange ? (
                    <ImageMediaReferenceField
                        themeId={themeId}
                        label="프로필 이미지"
                        imageMediaId={selectedChar.image_media_id ?? null}
                        legacyImageUrl={selectedChar.image_url ?? null}
                        pickerTitle="프로필 이미지 선택"
                        emptyLabel="이미지 선택"
                        compact
                        onSelect={(media) => onProfileImageChange(media.id)}
                        onClear={() => onProfileImageChange(null)}
                    />
                  ) : (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-center">
                      <span className="px-2 text-[11px] leading-5 text-slate-500">
                      현재 프로필 이미지를 편집할 수 없습니다.
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-2.5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">이름</p>
                      <p className="mt-1 text-sm text-slate-200">{selectedChar.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">공개 소개</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                        {selectedChar.description || '공개 소개가 없습니다.'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">역할</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-4">
                      {characterRoleOptions.map((option) => {
                        const active = selectedRole === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={!onMysteryRoleChange}
                            aria-label={option.label}
                            aria-pressed={active}
                            title={option.description}
                            onClick={() => onMysteryRoleChange?.(option.value)}
                            className={`min-h-11 rounded-lg border px-3 py-2 text-center transition ${
                              active
                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                            } disabled:cursor-default disabled:opacity-80`}
                          >
                            <span className="block text-xs font-semibold">{option.label}</span>
                            <span className="sr-only">{option.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                      등장인물 유형
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <VisibilityToggle
                        label="플레이어 캐릭터"
                        description="참가자가 선택하고 플레이하는 인물입니다."
                        checked={selectedView.isPlayable}
                        disabled={!onVisibilityChange}
                        onChange={(checked) => onVisibilityChange?.('is_playable', checked)}
                      />
                      <VisibilityToggle
                        label="등장인물 소개에 표시"
                        description="플레이 중 공개 소개 화면에 노출합니다."
                        checked={selectedView.showInIntro}
                        disabled={!onVisibilityChange}
                        onChange={(checked) => onVisibilityChange?.('show_in_intro', checked)}
                      />
                      <VisibilityToggle
                        label="읽기 대사에 사용"
                        description="스토리 읽기 화면에서 이 인물의 대사를 사용할 수 있습니다."
                        checked={selectedView.canSpeakInReading}
                        disabled={!onVisibilityChange}
                        onChange={(checked) =>
                          onVisibilityChange?.('can_speak_in_reading', checked)
                        }
                      />
                      <VisibilityToggle
                        label="투표 후보에 포함"
                        description="투표 단계에서 선택 가능한 대상으로 표시합니다."
                        checked={selectedView.isVotingCandidate}
                        disabled={!onVisibilityChange}
                        onChange={(checked) => onVisibilityChange?.('is_voting_candidate', checked)}
                      />
                    </div>
                  </div>
                  <CharacterAliasRulesEditor
                    characterName={selectedChar.name}
                    characterImageUrl={selectedChar.image_url}
                    rules={aliasDrafts}
                    characterOptions={characterOptions}
                    disabled={!onAliasRulesSave}
                    onChange={setAliasDrafts}
                    onSave={(rules) => {
                      if (!onAliasRulesSave) return;
                      onAliasRulesSave(rules);
                    }}
                  />
                </div>
              </div>
            ),
          },
          {
            id: 'endcard',
            title: '결과 카드',
            subtitle: selectedView.hasEndcard ? '작성됨' : '비어 있음',
            children: (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                      제목
                    </span>
                    <input
                      type="text"
                      value={endcardTitle}
                      maxLength={80}
                      disabled={!onEndcardChange}
                      onChange={(event) => setEndcardTitle(event.currentTarget.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-amber-500/60 disabled:opacity-70"
                      placeholder={`${selectedChar.name}의 후일담`}
                    />
                  </label>
                  <ImageMediaReferenceField
                    themeId={themeId}
                    label="결과 카드 이미지"
                    imageMediaId={endcardImageMediaId}
                    legacyImageUrl={selectedChar.endcard_image_url ?? null}
                    pickerTitle="결과 카드 이미지 선택"
                    emptyLabel="결과 카드 이미지 선택"
                    compact
                    disabled={!onEndcardChange}
                    onSelect={(media) => {
                      setEndcardImageMediaId(media.id);
                      setEndcardImageUrl('');
                    }}
                    onClear={() => setEndcardImageMediaId(null)}
                  />
                </div>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                    본문
                  </span>
                  <textarea
                    value={endcardBody}
                    maxLength={3000}
                    rows={5}
                    disabled={!onEndcardChange}
                    onChange={(event) => setEndcardBody(event.currentTarget.value)}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm leading-5 text-slate-200 outline-none transition focus:border-amber-500/60 disabled:opacity-70"
                    placeholder="게임 종료 후 이 인물에게 보여줄 내용을 작성하세요."
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!onEndcardChange || !endcardDirty}
                    onClick={() =>
                      onEndcardChange?.({
                        title: endcardTitle,
                        body: endcardBody,
                        imageUrl: endcardImageUrl,
                        imageMediaId: endcardImageMediaId,
                      })
                    }
                    className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950 disabled:text-slate-600"
                  >
                    결과 카드 저장
                  </button>
                </div>
              </div>
            ),
          },
          {
            id: 'role-sheet',
            title: '역할지',
            subtitle: 'Markdown 또는 PDF',
            children: (
              <CharacterRoleSheetSection
                themeId={themeId}
                characterId={selectedChar.id}
                characterName={selectedChar.name}
              />
            ),
          },
          {
            id: 'starting-clue',
            title: '시작 단서',
            subtitle: `${charClueIds.length}/${clues?.length ?? 0}개 배정`,
            children: (
              <StartingClueAssigner
                characterName={selectedChar.name}
                clues={clues ?? []}
                selectedIds={charClueIds}
                onClueToggle={onClueToggle}
              />
            ),
          },
          {
            id: 'hidden-mission',
            title: '히든 미션',
            subtitle: `${charMissions.length}개`,
            children: (
              <MissionEditor
                missions={charMissions}
                characters={characters}
                clues={clues ?? []}
                onAdd={onAddMission}
                onChange={onChangeMission}
                onDelete={onDeleteMission}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

interface VisibilityToggleProps {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

function VisibilityToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: VisibilityToggleProps) {
  return (
    <label
      className="flex min-h-14 items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-left"
      title={description}
    >
      <input
        type="checkbox"
        aria-label={label}
        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>
        <span className="block text-xs font-semibold text-slate-200">{label}</span>
        <span className="sr-only">{description}</span>
      </span>
    </label>
  );
}
