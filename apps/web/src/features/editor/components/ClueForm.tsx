import { useState, useEffect, useRef, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ImagePlus, ChevronDown, X, Loader2 } from 'lucide-react';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import {
  useCreateClue,
  useUpdateClue,
  type ClueResponse,
} from '@/features/editor/api';
import { mergeClueImage } from '@/features/editor/editorClueApi';
import { uploadImage } from '@/features/editor/imageApi';
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
  { value: 'normal', label: '일반' },
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
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const createClue = useCreateClue(themeId);
  const updateClue = useUpdateClue(themeId);

  // Revoke object URL when pendingPreview changes or component unmounts
  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
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

  function handleImageSelect(file: File) {
    // Revoke previous preview URL before creating a new one
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingImage(file);
    setPendingPreview(URL.createObjectURL(file));
  }

  function handleImageClear() {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingImage(null);
    setPendingPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleImageSelect(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageSelect(file);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  async function handleSubmit(e: FormEvent) {
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
      is_usable: isUsable,
      use_effect: isUsable ? useEffect_ : undefined,
      use_target: isUsable ? useTarget : undefined,
      use_consumed: isUsable ? useConsumed : undefined,
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
        onSuccess: async (newClue) => {
          // If an image was selected, upload it now that we have the clue ID
          if (pendingImage && newClue.id) {
            setIsUploading(true);
            try {
              const uploadedUrl = await uploadImage(
                themeId, 'clue', newClue.id, pendingImage, pendingImage.type,
              );
              // Merge image_url into the optimistic clue entry, then
              // invalidate — without this, the invalidate from useCreateClue
              // fires first with empty image_url and the row flashes blank.
              mergeClueImage(themeId, newClue.id, uploadedUrl);
            } catch {
              toast.error('단서는 저장되었지만 이미지 업로드에 실패했습니다');
            } finally {
              setIsUploading(false);
            }
          }
          toast.success('단서가 추가되었습니다');
          onClose();
        },
        onError: (err) => {
          toast.error(err.message || '단서 추가에 실패했습니다');
        },
      });
    }
  }

  const isPending = createClue.isPending || updateClue.isPending || isUploading;

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
        {/* Image section */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-300">이미지</span>

          {isEditMode ? (
            // Edit mode: use full ImageUpload component (existing clue has an ID)
            <ImageUpload
              themeId={themeId}
              targetId={clue.id}
              target="clue"
              currentImageUrl={imageUrl || null}
              onUploaded={(url) => setImageUrl(url)}
              aspectRatio="16/9"
              className="w-full max-w-xs"
            />
          ) : (
            // Create mode: select image locally, upload after create
            <div className="relative">
              {pendingPreview ? (
                <div className="relative w-full max-w-xs overflow-hidden rounded-lg border border-slate-700" style={{ aspectRatio: '16/9' }}>
                  <img
                    src={pendingPreview}
                    alt="미리보기"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleImageClear}
                    className="absolute right-1.5 top-1.5 rounded-full bg-slate-900/80 p-0.5 text-slate-300 hover:text-white"
                    aria-label="이미지 제거"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
                      <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="flex w-full max-w-xs cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-800/50 p-6 text-slate-500 transition-colors hover:border-amber-500/50 hover:text-amber-400"
                  style={{ aspectRatio: '16/9' }}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  aria-label="이미지 선택"
                >
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">클릭하거나 드래그하여 이미지 선택</span>
                  <span className="text-[11px] text-slate-600">JPG, PNG, WEBP</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileInputChange}
                className="sr-only"
                aria-hidden="true"
              />
            </div>
          )}
        </div>

        {/* Name */}
        <Input
          label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="단서 이름"
          required
          maxLength={100}
          error={errors.name}
        />

        {/* Description */}
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

        {/* Advanced settings toggle */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 transition-colors"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            />
            고급 설정
          </button>

          {showAdvanced && (
            <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              {/* Clue type */}
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

              {/* Level + Sort order */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="발견 난이도"
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

              {/* Is common */}
              <div className="flex items-center gap-2">
                <input
                  id="clue-is-common"
                  type="checkbox"
                  checked={isCommon}
                  onChange={(e) => setIsCommon(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                />
                <label htmlFor="clue-is-common" className="text-sm font-medium text-slate-300">
                  공개 단서 (모든 플레이어 공유)
                </label>
              </div>

              {/* 아이템 설정 */}
              <div className="border-t border-slate-800 pt-3 mt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    id="clue-is-usable"
                    type="checkbox"
                    checked={isUsable}
                    onChange={(e) => setIsUsable(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                  />
                  <label htmlFor="clue-is-usable" className="text-sm font-medium text-slate-300">
                    사용 가능 (아이템)
                  </label>
                </div>

                {isUsable && (
                  <div className="ml-6 space-y-3">
                    {/* Effect */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="clue-use-effect" className="text-sm font-medium text-slate-300">
                        효과
                      </label>
                      <select
                        id="clue-use-effect"
                        value={useEffect_}
                        onChange={(e) => setUseEffect(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="peek">엿보기 (Peek)</option>
                        <option value="steal">강탈 (Steal)</option>
                        <option value="reveal">공개 (Reveal)</option>
                        <option value="block">차단 (Block)</option>
                        <option value="swap">교환 (Swap)</option>
                      </select>
                    </div>

                    {/* Target */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="clue-use-target" className="text-sm font-medium text-slate-300">
                        대상
                      </label>
                      <select
                        id="clue-use-target"
                        value={useTarget}
                        onChange={(e) => setUseTarget(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="player">플레이어</option>
                        <option value="clue">단서</option>
                        <option value="self">자신</option>
                      </select>
                    </div>

                    {/* Consumed */}
                    <div className="flex items-center gap-2">
                      <input
                        id="clue-use-consumed"
                        type="checkbox"
                        checked={useConsumed}
                        onChange={(e) => setUseConsumed(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                      />
                      <label htmlFor="clue-use-consumed" className="text-sm font-medium text-slate-300">
                        사용 후 소멸
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
