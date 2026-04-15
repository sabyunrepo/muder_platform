import { useState, useEffect, type FormEvent } from 'react';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { type ClueResponse } from '@/features/editor/api';
import { useClueFormSubmit } from '@/features/editor/hooks/useClueFormSubmit';
import { ClueFormImageSection } from './ClueFormImageSection';
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
//   - image upload UI → ClueFormImageSection
//   - advanced/item-usage fields → ClueFormAdvancedFields
//   - create/update + post-create image upload → useClueFormSubmit
// ---------------------------------------------------------------------------

export function ClueForm({ themeId, clue, isOpen, onClose }: ClueFormProps) {
  const isEditMode = !!clue;

  // Core fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Advanced fields (hidden by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clueType, setClueType] = useState('normal');
  const [level, setLevel] = useState(1);
  const [isCommon, setIsCommon] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);

  // Item usage fields
  const [isUsable, setIsUsable] = useState(false);
  const [useEffect_, setUseEffect] = useState('peek');
  const [useTarget, setUseTarget] = useState('player');
  const [useConsumed, setUseConsumed] = useState(true);

  // Pending image for new clue (staged upload)
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

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
      setClueType(clue.clue_type ?? 'normal');
      setLevel(clue.level ?? 1);
      setIsCommon(clue.is_common ?? false);
      setSortOrder(clue.sort_order ?? 0);
      setIsUsable(clue.is_usable ?? false);
      setUseEffect(clue.use_effect ?? 'peek');
      setUseTarget(clue.use_target ?? 'player');
      setUseConsumed(clue.use_consumed ?? true);
    } else {
      setName('');
      setDescription('');
      setImageUrl('');
      setClueType('normal');
      setLevel(1);
      setIsCommon(false);
      setSortOrder(0);
      setIsUsable(false);
      setUseEffect('peek');
      setUseTarget('player');
      setUseConsumed(true);
    }
    setPendingImage(null);
    setPendingPreview(null);
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
    return next;
  }

  function handlePendingImageSelect(file: File) {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingImage(file);
    setPendingPreview(URL.createObjectURL(file));
  }

  function handlePendingImageClear() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingImage(null);
    setPendingPreview(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    submit(
      {
        name: name.trim(),
        description: description || undefined,
        image_url: imageUrl || undefined,
        clue_type: clueType,
        level,
        is_common: isCommon,
        sort_order: sortOrder,
        is_usable: isUsable,
        use_effect: isUsable ? useEffect_ : undefined,
        use_target: isUsable ? useTarget : undefined,
        use_consumed: isUsable ? useConsumed : undefined,
      },
      pendingImage,
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
        <ClueFormImageSection
          themeId={themeId}
          isEditMode={isEditMode}
          clueId={clue?.id}
          imageUrl={imageUrl}
          onImageUrlChange={setImageUrl}
          pendingImage={pendingImage}
          pendingPreview={pendingPreview}
          isUploading={isPending && !!pendingImage}
          onPendingImageSelect={handlePendingImageSelect}
          onPendingImageClear={handlePendingImageClear}
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
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          {errors.description && (
            <p className="text-sm text-red-400">{errors.description}</p>
          )}
        </div>

        <ClueFormAdvancedFields
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          clueType={clueType}
          onClueTypeChange={setClueType}
          level={level}
          onLevelChange={setLevel}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          isCommon={isCommon}
          onIsCommonChange={setIsCommon}
          isUsable={isUsable}
          onIsUsableChange={setIsUsable}
          useEffect_={useEffect_}
          onUseEffectChange={setUseEffect}
          useTarget={useTarget}
          onUseTargetChange={setUseTarget}
          useConsumed={useConsumed}
          onUseConsumedChange={setUseConsumed}
        />
      </form>
    </Modal>
  );
}
