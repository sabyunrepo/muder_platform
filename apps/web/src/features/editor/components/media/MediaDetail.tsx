import { useEffect, useState } from 'react';
import { AlertTriangle, Link2, RefreshCw, X, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  useDeleteMedia,
  useMediaCategories,
  useMediaDeletePreview,
  useUpdateMedia,
  type MediaReferenceInfo,
  type MediaResponse,
  type MediaType,
  type UpdateMediaRequest,
} from '@/features/editor/mediaApi';
import { editorDesignClassNames } from '@/features/editor/design-system/editorDesignTokens';
import { ApiHttpError } from '@/lib/api-error';
import { ConfirmDialog } from '@/shared/components/ui';
import { MediaReplaceModal } from './MediaReplaceModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaDetailProps {
  media: MediaResponse;
  themeId: string;
  onClose: () => void;
}

const AUDIO_MEDIA_TYPES: MediaType[] = ['BGM', 'SFX', 'VOICE'];
const PLAYABLE_MEDIA_TYPES: MediaType[] = ['BGM', 'SFX', 'VOICE', 'VIDEO'];

// ---------------------------------------------------------------------------
// MediaDetail
// ---------------------------------------------------------------------------

export function MediaDetail({ media, themeId, onClose }: MediaDetailProps) {
  const [name, setName] = useState(media.name);
  const [tagsText, setTagsText] = useState((media.tags ?? []).join(', '));
  const [sortOrder, setSortOrder] = useState<number>(media.sort_order);
  const [categoryId, setCategoryId] = useState<string>(media.category_id ?? '');
  const [mediaType, setMediaType] = useState<MediaType>(media.type);
  const [referenceWarning, setReferenceWarning] = useState<MediaReferenceInfo[] | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Reset local state when selected media changes
  useEffect(() => {
    setName(media.name);
    setTagsText((media.tags ?? []).join(', '));
    setSortOrder(media.sort_order);
    setCategoryId(media.category_id ?? '');
    setMediaType(media.type);
    setReferenceWarning(null);
    setReplaceOpen(false);
    setDeleteDialogOpen(false);
  }, [media.id, media.name, media.tags, media.sort_order, media.category_id, media.type]);

  const updateMutation = useUpdateMedia(themeId);
  const deleteMutation = useDeleteMedia(themeId);
  const { data: categories = [] } = useMediaCategories(themeId);
  const { data: deletePreview, isLoading: deletePreviewLoading } = useMediaDeletePreview(media.id);
  const references = deletePreview?.references ?? [];
  const referencesToDetach = references.length > 0 ? references : (referenceWarning ?? []);
  const hasReferences = referencesToDetach.length > 0;
  const canReplaceFile = media.source_type === 'FILE' && media.type !== 'VIDEO';
  const typeOptions = getEditableMediaTypeOptions(media.type);
  const canChangeMediaType = typeOptions.length > 1;
  const canShowDuration = PLAYABLE_MEDIA_TYPES.includes(mediaType);
  const showCategorySelect = categories.length > 0 || Boolean(media.category_id);

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
    const patch: UpdateMediaRequest = {
      name: trimmedName,
      type: mediaType,
      sort_order: sortOrder,
      tags,
      ...(showCategorySelect ? { category_id: categoryId || undefined } : {}),
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
    try {
      await deleteMutation.mutateAsync({ id: media.id, detachReferences: hasReferences });
      setDeleteDialogOpen(false);
      toast.success(hasReferences ? '연결을 해제하고 미디어를 삭제했습니다' : '미디어가 삭제되었습니다');
      onClose();
    } catch (err) {
      setDeleteDialogOpen(false);
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
        <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--mmp-editor-color-slate)]">미디어 상세</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="상세 닫기"
          className={`p-1 transition-colors ${editorDesignClassNames.iconButton}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--mmp-editor-color-slate)]">
            이름
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`h-8 px-2 text-xs ${editorDesignClassNames.input}`}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--mmp-editor-color-slate)]">
            태그 (쉼표 구분)
          </span>
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="전투, 긴장감"
            className={`h-8 px-2 text-xs ${editorDesignClassNames.input}`}
          />
        </label>

        {(showCategorySelect || canChangeMediaType) && (
          <div className="grid grid-cols-2 gap-3">
            {showCategorySelect && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--mmp-editor-color-slate)]">
                  카테고리
                </span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={`h-8 px-2 text-xs ${editorDesignClassNames.input}`}
                >
                  <option value="">전체</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {canChangeMediaType && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--mmp-editor-color-slate)]">
                  분류
                </span>
                <select
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as MediaType)}
                  className={`h-8 px-2 text-xs ${editorDesignClassNames.input}`}
                >
                  {typeOptions.map((option) => (
                    <option key={option} value={option}>
                      {mediaTypeLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        <dl className={`grid gap-2 px-3 py-2 text-xs ${editorDesignClassNames.subtlePanel}`}>
          {!canChangeMediaType && <MediaInfoRow label="분류" value={mediaTypeLabel(media.type)} />}
          {canShowDuration && <MediaInfoRow label="길이" value={formatDurationInfo(media.duration)} />}
          <MediaInfoRow label="출처" value={mediaSourceLabel(media.source_type)} />
          {media.mime_type && <MediaInfoRow label="파일 형식" value={mimeTypeLabel(media.mime_type)} />}
          {media.file_size != null && (
            <MediaInfoRow label="파일 크기" value={formatFileSize(media.file_size)} />
          )}
        </dl>

        <MediaReferencesPreview references={references} loading={deletePreviewLoading} />

        {referenceWarning && (
          <div
            role="alert"
            className="rounded-sm border border-[var(--mmp-editor-color-warning)] bg-[var(--mmp-editor-color-tint-yellow)] px-3 py-2 text-xs text-[var(--mmp-editor-color-charcoal)]"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--mmp-editor-color-warning)]" />
              <div className="min-w-0 space-y-1">
                <p className="font-medium">이 미디어가 아직 사용 중입니다.</p>
                <p className="text-[11px] text-[var(--mmp-editor-color-slate)]">
                  삭제를 다시 누르면 아래 연결을 해제한 뒤 삭제할 수 있습니다.
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
          onClick={() => setDeleteDialogOpen(true)}
          disabled={deleteMutation.isPending}
          className={`flex h-8 items-center gap-1.5 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${editorDesignClassNames.dangerAction}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          삭제
        </button>
        <div className="flex items-center gap-2">
          {canReplaceFile && (
            <button
              type="button"
              onClick={() => setReplaceOpen(true)}
              className={`flex h-8 items-center gap-1.5 px-3 text-xs ${editorDesignClassNames.secondaryAction}`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              교체
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className={`flex h-8 items-center gap-1.5 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${editorDesignClassNames.primaryAction}`}
          >
            <Save className="h-3.5 w-3.5" />
            저장
          </button>
        </div>
      </div>
      <MediaReplaceModal
        open={replaceOpen}
        onClose={() => setReplaceOpen(false)}
        themeId={themeId}
        media={media}
        onReplaced={() => toast.success('파일을 교체했습니다')}
      />
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title="미디어를 삭제할까요?"
        description={
          hasReferences
            ? `"${media.name}" 미디어가 ${referencesToDetach.length}곳에서 사용 중입니다. 삭제하면 해당 연결을 모두 해제합니다.`
            : `"${media.name}" 미디어를 삭제합니다.`
        }
        confirmLabel={hasReferences ? '연결 해제 후 삭제' : '미디어 삭제'}
        isConfirming={deleteMutation.isPending}
        tone="danger"
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

function MediaReferencesPreview({
  references,
  loading,
}: {
  references: MediaReferenceInfo[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className={`px-3 py-2 text-xs ${editorDesignClassNames.subtlePanel}`}>
        사용 위치 확인 중...
      </div>
    );
  }
  if (references.length === 0) {
    return (
      <div className={`px-3 py-2 text-xs ${editorDesignClassNames.subtlePanel}`}>
        아직 연결된 제작 요소가 없습니다.
      </div>
    );
  }
  return (
    <div className="rounded-sm border border-[var(--mmp-editor-color-warning)] bg-[var(--mmp-editor-color-tint-yellow)] px-3 py-2 text-xs text-[var(--mmp-editor-color-charcoal)]">
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--mmp-editor-color-warning)]" />
        <div className="min-w-0">
          <p className="font-medium">사용 중인 위치 {references.length}개</p>
          <p className="mt-1 text-[11px] text-[var(--mmp-editor-color-slate)]">
            삭제하면 아래 연결도 함께 해제됩니다. 교체는 연결을 유지합니다.
          </p>
          <ul className="mt-2 space-y-1">
            {references.slice(0, 5).map((ref, index) => (
              <li key={`${ref.type}-${ref.id}-${index}`} className="break-words">
                <span className="font-medium">{mediaReferenceTypeLabel(ref.type)}</span>: {ref.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function MediaInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--mmp-editor-color-slate)]">{label}</dt>
      <dd className="text-right text-[var(--mmp-editor-color-charcoal)]">{value}</dd>
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

function getEditableMediaTypeOptions(type: MediaType): MediaType[] {
  if (AUDIO_MEDIA_TYPES.includes(type)) {
    return AUDIO_MEDIA_TYPES;
  }
  return [type];
}

function formatDurationInfo(duration: number | undefined): string {
  if (duration == null || !Number.isFinite(duration) || duration < 0) {
    return '자동 확인 안 됨';
  }
  const totalSeconds = Math.round(duration);
  if (totalSeconds < 60) {
    return `${totalSeconds}초`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`;
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
    'audio/x-wav': 'WAV',
    'audio/wave': 'WAV',
    'audio/vnd.wave': 'WAV',
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
