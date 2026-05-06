import { useState, useEffect, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/Button';
import {
  useUpdateTheme,
  type EditorThemeResponse,
  type UpdateThemeRequest,
} from '@/features/editor/api';
import { SectionDivider } from './SectionDivider';
import { CoverImageCropUpload } from './CoverImageCropUpload';
import { LocationImageMediaField } from './design/LocationImageMediaField';

// ---------------------------------------------------------------------------
// SpecField — inline number input with label + unit
// ---------------------------------------------------------------------------

interface SpecFieldProps {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  error?: string;
}

function SpecField({ label, unit, value, onChange, min, max, error }: SpecFieldProps) {
  return (
    <div className="rounded-sm border border-slate-800 bg-slate-900 p-3">
      <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-slate-600">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent text-2xl font-mono font-bold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 focus:text-amber-400 transition-colors"
        />
        <span className="text-xs text-slate-600">{unit}</span>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PriceField — same shape but for price inputs
// ---------------------------------------------------------------------------

interface PriceFieldProps {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  error?: string;
}

function PriceField({ label, unit, value, onChange, min, max, error }: PriceFieldProps) {
  return (
    <div className="rounded-sm border border-slate-800 bg-slate-900 p-3">
      <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-slate-600">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent text-xl font-mono font-bold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 focus:text-amber-400 transition-colors"
        />
        <span className="text-xs text-slate-600">{unit}</span>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OverviewTab
// ---------------------------------------------------------------------------

interface OverviewTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

export function OverviewTab({ themeId, theme }: OverviewTabProps) {
  const [title, setTitle] = useState(theme.title);
  const [description, setDescription] = useState(theme.description ?? '');
  const [coverImage, setCoverImage] = useState<string | null>(theme.cover_image || null);
  const [coverImageMediaId, setCoverImageMediaId] = useState<string | null>(
    theme.cover_image_media_id ?? null
  );
  const [minPlayers, setMinPlayers] = useState(theme.min_players);
  const [maxPlayers, setMaxPlayers] = useState(theme.max_players);
  const [durationMin, setDurationMin] = useState(theme.duration_min);
  const [price, setPrice] = useState(theme.price);
  const [coinPrice, setCoinPrice] = useState(theme.coin_price);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateTheme = useUpdateTheme(themeId);

  useEffect(() => {
    setTitle(theme.title);
    setDescription(theme.description ?? '');
    setCoverImage(theme.cover_image || null);
    setCoverImageMediaId(theme.cover_image_media_id ?? null);
    setMinPlayers(theme.min_players);
    setMaxPlayers(theme.max_players);
    setDurationMin(theme.duration_min);
    setPrice(theme.price);
    setCoinPrice(theme.coin_price);
    setErrors({});
  }, [theme.id, theme.version]);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    const trimmedTitle = title.trim();
    if (!trimmedTitle) next.title = '제목은 필수입니다';
    else if (trimmedTitle.length > 100) next.title = '제목은 100자 이하여야 합니다';
    if (description.length > 2000) next.description = '설명은 2000자 이하여야 합니다';
    if (minPlayers < 2 || minPlayers > 20) next.minPlayers = '최소 인원은 2~20 사이여야 합니다';
    if (maxPlayers < 2 || maxPlayers > 20) next.maxPlayers = '최대 인원은 2~20 사이여야 합니다';
    else if (maxPlayers < minPlayers) next.maxPlayers = '최대 인원은 최소 인원 이상이어야 합니다';
    if (durationMin < 10 || durationMin > 300)
      next.durationMin = '진행 시간은 10~300분 사이여야 합니다';
    if (price < 0) next.price = '가격은 0 이상이어야 합니다';
    if (coinPrice < 0 || coinPrice > 100000)
      next.coinPrice = '코인 가격은 0~100,000 사이여야 합니다';
    return next;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const body: UpdateThemeRequest = {
      title: title.trim(),
      description: description || undefined,
      cover_image: coverImage || undefined,
      cover_image_media_id: coverImageMediaId,
      min_players: minPlayers,
      max_players: maxPlayers,
      duration_min: durationMin,
      price,
      coin_price: coinPrice,
    };

    updateTheme.mutate(body, {
      onSuccess: () => toast.success('테마가 수정되었습니다'),
      onError: (err) => toast.error(err.message || '테마 수정에 실패했습니다'),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-4 py-6">
      {/* ── 기본 정보 ── */}
      <SectionDivider label="기본 정보" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
        {/* Thumbnail */}
        <CoverImageCropUpload
          themeId={themeId}
          currentImageUrl={coverImage}
          onUploaded={(url) => {
            setCoverImage(url || null);
            setCoverImageMediaId(null);
          }}
          className="w-full"
        />

        {/* Text fields */}
        <div className="flex flex-col gap-3">
          {/* 제목 */}
          <div>
            <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-slate-600 mb-1">
              제목
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="테마 제목"
              maxLength={100}
              className="w-full rounded-sm border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-700 focus:border-amber-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 transition-colors"
            />
            {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
          </div>

          {/* 세부 설명 */}
          <div>
            <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-slate-600 mb-1">
              세부 설명
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="테마에 대한 세부 설명을 입력하세요"
              maxLength={2000}
              rows={3}
              className="w-full rounded-sm border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-700 focus:border-amber-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 transition-colors resize-none"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-400">{errors.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <LocationImageMediaField
          themeId={themeId}
          label="테마 커버 이미지"
          pickerTitle="테마 커버 이미지 선택"
          emptyLabel="미디어에서 커버 선택"
          legacyMessage="기존 커버 업로드 이미지가 있습니다. 미디어 관리 이미지로 교체하면 이후 한 곳에서 관리할 수 있습니다."
          imageMediaId={coverImageMediaId}
          legacyImageUrl={coverImage}
          onSelect={(media) => {
            setCoverImageMediaId(media.id);
            setCoverImage(null);
          }}
          onClear={() => setCoverImageMediaId(null)}
        />
      </div>

      {/* ── 게임 스펙 ── */}
      <SectionDivider label="게임 스펙" />

      <div className="grid grid-cols-3 gap-3">
        <SpecField
          label="최소 인원"
          unit="명"
          value={minPlayers}
          onChange={setMinPlayers}
          min={2}
          max={20}
          error={errors.minPlayers}
        />
        <SpecField
          label="최대 인원"
          unit="명"
          value={maxPlayers}
          onChange={setMaxPlayers}
          min={2}
          max={20}
          error={errors.maxPlayers}
        />
        <SpecField
          label="플레이 시간"
          unit="분"
          value={durationMin}
          onChange={setDurationMin}
          min={10}
          max={300}
          error={errors.durationMin}
        />
      </div>

      {/* ── 가격 설정 ── */}
      <SectionDivider label="가격 설정" />

      <div className="grid grid-cols-2 gap-3">
        <PriceField
          label="가격"
          unit="원"
          value={price}
          onChange={setPrice}
          min={0}
          error={errors.price}
        />
        <PriceField
          label="코인 가격"
          unit="코인"
          value={coinPrice}
          onChange={setCoinPrice}
          min={0}
          max={100000}
          error={errors.coinPrice}
        />
      </div>

      {/* Save */}
      <div className="mt-8 flex justify-end">
        <Button type="submit" isLoading={updateTheme.isPending}>
          저장
        </Button>
      </div>
    </form>
  );
}
