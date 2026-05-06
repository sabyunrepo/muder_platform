import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { type ClueResponse } from '@/features/editor/api';
import { useClueFormSubmit } from '@/features/editor/hooks/useClueFormSubmit';
import { ImageMediaReferenceField } from '@/features/editor/components/media/ImageMediaReferenceField';
import { buildClueUsePayload, getClueUseEffectOption } from '@/features/editor/entities/clue/clueEntityAdapter';
import { ClueFormAdvancedFields } from './ClueFormAdvancedFields';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClueFormProps {
  themeId: string;
  clue?: ClueResponse;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// ClueForm
//
// Slim shell that owns controlled form state and delegates:
//   - image media selection → ImageMediaReferenceField
//   - advanced/item-usage fields → ClueFormAdvancedFields
//   - create/update → useClueFormSubmit
// ---------------------------------------------------------------------------

export function ClueForm({ themeId, clue, isOpen, onClose }: ClueFormProps) {
  const isEditMode = !!clue;

  // Core fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageMediaId, setImageMediaId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Advanced fields (hidden by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isCommon, setIsCommon] = useState(false);

  // Level / sort order — UI removed (Phase 20 PR-1) but backend still requires
  // them (level validate:min=1, sort_order validate:min=0). We hold defaults
  // and, in edit mode, the clue's existing values so payloads stay valid.
  const [level, setLevel] = useState(1);
  const [sortOrder, setSortOrder] = useState(0);

  // Item usage fields
  const [isUsable, setIsUsable] = useState(false);
  const [useEffect_, setUseEffect] = useState('peek');
  const [useTarget, setUseTarget] = useState('player');
  const [useConsumed, setUseConsumed] = useState(true);

  // Round schedule (null = unbounded on that side)
  const [revealRound, setRevealRound] = useState<number | null>(null);
  const [hideRound, setHideRound] = useState<number | null>(null);

  const { submit, isPending } = useClueFormSubmit({
    themeId,
    clue,
    onDone: onClose,
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) return;
    if (clue) {
      setName(clue.name);
      setDescription(clue.description ?? '');
      setImageUrl(clue.image_url ?? '');
      setImageMediaId(clue.image_media_id ?? null);
      setIsCommon(clue.is_common ?? false);
      setLevel(clue.level ?? 1);
      setSortOrder(clue.sort_order ?? 0);
      setIsUsable(clue.is_usable ?? false);
      setUseEffect(clue.use_effect ?? 'peek');
      setUseTarget(clue.use_target ?? 'player');
      setUseConsumed(clue.use_consumed ?? true);
      setRevealRound(clue.reveal_round ?? null);
      setHideRound(clue.hide_round ?? null);
    } else {
      setName('');
      setDescription('');
      setImageUrl('');
      setImageMediaId(null);
      setIsCommon(false);
      setLevel(1);
      setSortOrder(0);
      setIsUsable(false);
      setUseEffect('peek');
      setUseTarget('player');
      setUseConsumed(true);
      setRevealRound(null);
      setHideRound(null);
    }
    setErrors({});
    setShowAdvanced(false);
  }, [isOpen, clue]);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    const trimmedName = name.trim();
    if (!trimmedName) {
      next.name = '이름은 필수입니다';
    } else if (trimmedName.length > 100) {
      next.name = '이름은 100자 이하여야 합니다';
    }
    if (description.length > 2000) {
      next.description = '설명은 2000자 이하여야 합니다';
    }
    if (
      revealRound != null &&
      hideRound != null &&
      revealRound > hideRound
    ) {
      next.round = '공개 라운드는 사라짐 라운드보다 클 수 없습니다';
    }
    return next;
  }

  function handleUseEffectChange(effect: string) {
    setUseEffect(effect);
    const option = getClueUseEffectOption(effect);
    if (option) setUseTarget(option.target);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    submit(
      buildClueUsePayload({
        name: name.trim(),
        description: description || undefined,
        image_url: imageMediaId ? '' : imageUrl || undefined,
        image_media_id: imageMediaId,
        level,
        sort_order: sortOrder,
        is_common: isCommon,
        is_usable: isUsable,
        use_effect: isUsable ? useEffect_ : undefined,
        use_target: isUsable ? useTarget : undefined,
        use_consumed: isUsable ? useConsumed : undefined,
        reveal_round: revealRound,
        hide_round: hideRound,
      }),
      null,
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? '단서 수정' : '단서 추가'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button type="submit" form="clue-form" isLoading={isPending}>
            저장
          </Button>
        </>
      }
    >
      <form id="clue-form" onSubmit={handleSubmit} className="space-y-4">
        <ImageMediaReferenceField
          themeId={themeId}
          label="단서 이미지"
          imageMediaId={imageMediaId}
          legacyImageUrl={imageUrl || null}
          pickerTitle="단서 이미지 선택"
          emptyLabel="단서 이미지 선택"
          compact
          disabled={isPending}
          onSelect={(media) => {
            setImageMediaId(media.id);
            setImageUrl('');
          }}
          onClear={() => setImageMediaId(null)}
        />

        <Input
          label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="단서 이름"
          required
          maxLength={100}
          error={errors.name}
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="clue-description"
            className="text-sm font-medium text-slate-300"
          >
            설명
          </label>
          <textarea
            id="clue-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="단서에 대한 설명"
            maxLength={2000}
            rows={3}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
          />
          {errors.description && (
            <p className="text-sm text-red-400">{errors.description}</p>
          )}
        </div>

        <ClueFormAdvancedFields
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          isCommon={isCommon}
          onIsCommonChange={setIsCommon}
          isUsable={isUsable}
          onIsUsableChange={setIsUsable}
          useEffect_={useEffect_}
          onUseEffectChange={handleUseEffectChange}
          useTarget={useTarget}
          onUseTargetChange={setUseTarget}
          useConsumed={useConsumed}
          onUseConsumedChange={setUseConsumed}
          revealRound={revealRound}
          onRevealRoundChange={setRevealRound}
          hideRound={hideRound}
          onHideRoundChange={setHideRound}
          roundError={errors.round}
        />
      </form>
    </Modal>
  );
}
