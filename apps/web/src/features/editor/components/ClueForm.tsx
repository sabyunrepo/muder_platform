import { useState, useEffect, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import {
  useCreateClue,
  useUpdateClue,
  type ClueResponse,
} from '@/features/editor/api';
import { ImageUpload } from './ImageUpload';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClueFormProps {
  themeId: string;
  clue?: ClueResponse;
  isOpen: boolean;
  onClose: () => void;
}

const CLUE_TYPES = [
  { value: 'physical', label: '물리적 단서' },
  { value: 'document', label: '문서' },
  { value: 'testimony', label: '증언' },
  { value: 'digital', label: '디지털' },
  { value: 'other', label: '기타' },
] as const;

// ---------------------------------------------------------------------------
// ClueForm
// ---------------------------------------------------------------------------

export function ClueForm({ themeId, clue, isOpen, onClose }: ClueFormProps) {
  const isEditMode = !!clue;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [clueType, setClueType] = useState('physical');
  const [level, setLevel] = useState(1);
  const [isCommon, setIsCommon] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createClue = useCreateClue(themeId);
  const updateClue = useUpdateClue(themeId);

  useEffect(() => {
    if (isOpen) {
      if (clue) {
        setName(clue.name);
        setDescription(clue.description ?? '');
        setImageUrl(clue.image_url ?? '');
        setClueType(clue.clue_type ?? 'physical');
        setLevel(clue.level ?? 1);
        setIsCommon(clue.is_common ?? false);
        setSortOrder(clue.sort_order ?? 0);
      } else {
        setName('');
        setDescription('');
        setImageUrl('');
        setClueType('physical');
        setLevel(1);
        setIsCommon(false);
        setSortOrder(0);
      }
      setErrors({});
    }
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const body = {
      name: name.trim(),
      description: description || undefined,
      image_url: imageUrl || undefined,
      clue_type: clueType,
      level,
      is_common: isCommon,
      sort_order: sortOrder,
    };

    if (isEditMode) {
      updateClue.mutate(
        { clueId: clue.id, body },
        {
          onSuccess: () => {
            toast.success('단서가 수정되었습니다');
            onClose();
          },
          onError: (err) => {
            toast.error(err.message || '단서 수정에 실패했습니다');
          },
        },
      );
    } else {
      createClue.mutate(body, {
        onSuccess: () => {
          toast.success('단서가 추가되었습니다');
          onClose();
        },
        onError: (err) => {
          toast.error(err.message || '단서 추가에 실패했습니다');
        },
      });
    }
  }

  const isPending = createClue.isPending || updateClue.isPending;

  // We need a stable targetId for new clues — use a placeholder that the
  // backend will accept. For edit mode we use the real clue id.
  const targetId = clue?.id ?? 'new';
  const canUploadImage = isEditMode;

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
        {/* Image upload — only available in edit mode (we need a real clue id) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-300">이미지</span>
          {canUploadImage ? (
            <ImageUpload
              themeId={themeId}
              targetId={targetId}
              target="clue"
              currentImageUrl={imageUrl || null}
              onUploaded={(url) => setImageUrl(url)}
              aspectRatio="16/9"
              className="w-full max-w-xs"
            />
          ) : (
            <div className="flex items-center gap-2 rounded-sm border border-dashed border-slate-700 px-3 py-2">
              <span className="text-xs text-slate-500">
                단서를 먼저 저장한 후 이미지를 업로드할 수 있습니다
              </span>
            </div>
          )}
        </div>

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
          <label htmlFor="clue-description" className="text-sm font-medium text-slate-300">
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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="clue-type" className="text-sm font-medium text-slate-300">
            단서 유형
          </label>
          <select
            id="clue-type"
            value={clueType}
            onChange={(e) => setClueType(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {CLUE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="레벨"
            type="number"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            min={1}
            max={10}
          />
          <Input
            label="정렬 순서"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            min={0}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="clue-is-common"
            type="checkbox"
            checked={isCommon}
            onChange={(e) => setIsCommon(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
          />
          <label htmlFor="clue-is-common" className="text-sm font-medium text-slate-300">
            공통 단서 (모든 플레이어 공유)
          </label>
        </div>
      </form>
    </Modal>
  );
}
