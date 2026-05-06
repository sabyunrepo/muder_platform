import { useEffect, useState } from 'react';
import { AlertTriangle, X, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  useDeleteMedia,
  useMediaCategories,
  useUpdateMedia,
  type MediaReferenceInfo,
  type MediaResponse,
  type UpdateMediaRequest,
} from '@/features/editor/mediaApi';
import { ApiHttpError } from '@/lib/api-error';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaDetailProps {
  media: MediaResponse;
  themeId: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// MediaDetail
// ---------------------------------------------------------------------------

export function MediaDetail({ media, themeId, onClose }: MediaDetailProps) {
  const [name, setName] = useState(media.name);
  const [tagsText, setTagsText] = useState((media.tags ?? []).join(', '));
  const [sortOrder, setSortOrder] = useState<number>(media.sort_order);
  const [categoryId, setCategoryId] = useState<string>(media.category_id ?? '');
  const [duration, setDuration] = useState<string>(
    media.duration != null ? String(media.duration) : ''
  );
  const [referenceWarning, setReferenceWarning] = useState<MediaReferenceInfo[] | null>(null);

  // Reset local state when selected media changes
  useEffect(() => {
    setName(media.name);
    setTagsText((media.tags ?? []).join(', '));
    setSortOrder(media.sort_order);
    setCategoryId(media.category_id ?? '');
    setDuration(media.duration != null ? String(media.duration) : '');
    setReferenceWarning(null);
  }, [media.id, media.name, media.tags, media.sort_order, media.category_id, media.duration]);

  const updateMutation = useUpdateMedia(themeId);
  const deleteMutation = useDeleteMedia(themeId);
  const { data: categories = [] } = useMediaCategories(themeId);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('이름은 필수입니다');
      return;
    }
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const durationNum = duration.trim() ? Number(duration) : undefined;
    if (durationNum != null && (!Number.isFinite(durationNum) || durationNum < 0)) {
      toast.error('길이는 0 이상 숫자여야 합니다');
      return;
    }
    const patch: UpdateMediaRequest = {
      name: trimmedName,
      type: media.type,
      sort_order: sortOrder,
      tags,
      category_id: categoryId || undefined,
      ...(durationNum != null ? { duration: durationNum } : {}),
    };
    updateMutation.mutate(
      { id: media.id, patch },
      {
        onSuccess: () => toast.success('미디어가 저장되었습니다'),
        onError: () => toast.error('미디어 저장에 실패했습니다'),
      }
    );
  };

  const handleDelete = async () => {
    setReferenceWarning(null);
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`"${media.name}"을(를) 삭제하시겠습니까?`);
      if (!ok) return;
    }
    try {
      await deleteMutation.mutateAsync(media.id);
      toast.success('미디어가 삭제되었습니다');
      onClose();
    } catch (err) {
      if (err instanceof ApiHttpError && err.apiError.code === 'MEDIA_REFERENCE_IN_USE') {
        const refs = err.apiError.params?.references as MediaReferenceInfo[] | undefined;
        setReferenceWarning(refs?.length ? refs : []);
        return;
      }
      toast.error('미디어 삭제에 실패했습니다');
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase tracking-widest text-slate-500">미디어 상세</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="상세 닫기"
          className="rounded-sm p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
            이름
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 rounded-sm border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
            태그 (쉼표 구분)
          </span>
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="전투, 긴장감"
            className="h-8 rounded-sm border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              카테고리
            </span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-8 rounded-sm border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
            >
              <option value="">전체</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600">
              길이 (초)
            </span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="h-8 rounded-sm border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
            />
          </label>
        </div>

        <dl className="grid gap-2 rounded-sm border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs">
          <MediaInfoRow label="분류" value={mediaTypeLabel(media.type)} />
          <MediaInfoRow label="출처" value={mediaSourceLabel(media.source_type)} />
          {media.mime_type && <MediaInfoRow label="파일 형식" value={mimeTypeLabel(media.mime_type)} />}
          {media.file_size != null && (
            <MediaInfoRow label="파일 크기" value={formatFileSize(media.file_size)} />
          )}
        </dl>

        {referenceWarning && (
          <div
            role="alert"
            className="rounded-sm border border-amber-700/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-100"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-400" />
              <div className="min-w-0 space-y-1">
                <p className="font-medium">이 미디어는 아직 삭제할 수 없습니다.</p>
                <p className="text-[11px] text-amber-200/80">
                  먼저 아래 제작 요소에서 이 미디어 연결을 해제하세요.
                </p>
                {referenceWarning.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {referenceWarning.map((ref, index) => (
                      <li key={`${ref.type}-${ref.id}-${index}`} className="break-words">
                        <span className="font-medium">{mediaReferenceTypeLabel(ref.type)}</span>:{' '}
                        {ref.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="flex h-8 items-center gap-1.5 rounded-sm border border-rose-800 px-3 text-xs font-medium text-rose-400 transition-colors hover:border-rose-500 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          삭제
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex h-8 items-center gap-1.5 rounded-sm bg-amber-600 px-3 text-xs font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" />
          저장
        </button>
      </div>
    </div>
  );
}

function MediaInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-300">{value}</dd>
    </div>
  );
}

function mediaTypeLabel(type: MediaResponse['type']): string {
  switch (type) {
    case 'BGM':
      return '배경음악';
    case 'SFX':
      return '효과음';
    case 'VOICE':
      return '음성';
    case 'IMAGE':
      return '이미지';
    case 'VIDEO':
      return '영상';
    case 'DOCUMENT':
      return '문서';
    default:
      return '미디어';
  }
}

function mediaSourceLabel(source: MediaResponse['source_type']): string {
  switch (source) {
    case 'FILE':
      return '직접 업로드';
    case 'YOUTUBE':
      return 'YouTube';
    default:
      return '등록된 리소스';
  }
}

function mimeTypeLabel(mimeType: string): string {
  const labels: Record<string, string> = {
    'audio/mpeg': 'MP3',
    'audio/wav': 'WAV',
    'audio/ogg': 'OGG',
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WEBP',
    'video/mp4': 'MP4',
    'video/webm': 'WEBM',
  };
  return labels[mimeType.toLowerCase()] ?? '지원 파일';
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '알 수 없음';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function mediaReferenceTypeLabel(type: string): string {
  switch (type) {
    case 'reading_section':
      return '리딩 섹션';
    case 'role_sheet':
      return '역할지';
    case 'phase_action':
      return '단계 연출';
    case 'event_trigger_action':
    case 'event_progression_trigger_action':
      return '트리거 연출';
    default:
      return '사용 위치';
  }
}
