import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Image, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { MediaPicker } from '@/features/editor/components/media/MediaPicker';
import { useMediaList } from '@/features/editor/mediaApi';
import type { ImageRoleSheetPageDraft } from './useRoleSheetEditorState';

export interface ImageRoleSheetPanelProps {
  themeId: string;
  characterName: string;
  imagePages: ImageRoleSheetPageDraft[];
  imageDraft: string;
  page: number;
  saveStatus: 'idle' | 'saved' | 'failed';
  isPending: boolean;
  onImageDraftChange: (url: string) => void;
  onAddImagePage: () => void;
  onAddImageMediaPage: (mediaId: string) => void;
  onRemoveImagePage: (index: number) => void;
  onMoveImagePage: (index: number, direction: -1 | 1) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSave: () => void;
}

export function ImageRoleSheetPanel({
  themeId,
  characterName,
  imagePages,
  imageDraft,
  page,
  saveStatus,
  isPending,
  onImageDraftChange,
  onAddImagePage,
  onAddImageMediaPage,
  onRemoveImagePage,
  onMoveImagePage,
  onPrevious,
  onNext,
  onSave,
}: ImageRoleSheetPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: imageMedia = [] } = useMediaList(themeId, 'IMAGE');
  const imageMediaById = new Map(imageMedia.map((media) => [media.id, media]));
  const totalPages = imagePages.length;
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const currentPage = imagePages[safePage - 1];
  const currentImageUrl = currentPage?.kind === 'media'
    ? imageMediaById.get(currentPage.mediaId)?.url
    : currentPage?.url;
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [currentImageUrl]);

  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-start gap-2">
        <Image className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/80" />
        <div>
          <p className="text-xs font-semibold text-slate-300">이미지 롤지</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            JPG, PNG, WebP처럼 웹에서 열 수 있는 이미지 URL을 순서대로 등록합니다. 모바일에서도 한 장씩 넘겨 읽습니다.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          aria-label="이미지 페이지 URL"
          value={imageDraft}
          onChange={(event) => onImageDraftChange(event.target.value)}
          placeholder="https://cdn.example.com/role-page-1.webp"
          className="min-w-0 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        />
        <Button size="sm" variant="secondary" onClick={onAddImagePage}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          이미지 페이지 추가
        </Button>
      </div>
      <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        미디어 라이브러리에서 추가
      </Button>

      {totalPages === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 p-6 text-center">
          <p className="text-sm font-semibold text-slate-300">아직 이미지 페이지가 없습니다.</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{characterName} 플레이어가 읽을 역할지 이미지를 1장 이상 추가해 주세요.</p>
        </div>
      ) : (
        <>
          <ol className="min-w-0 space-y-2" aria-label="이미지 롤지 페이지 목록">
            {imagePages.map((imagePage, index) => {
              const media = imagePage.kind === 'media' ? imageMediaById.get(imagePage.mediaId) : undefined;
              const label = imagePage.kind === 'media' ? media?.name ?? '선택된 이미지' : imagePage.url;
              return (
                <li key={imagePage.kind === 'media' ? `${imagePage.mediaId}-${index}` : `${imagePage.url}-${index}`} className="min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 sm:flex sm:items-center sm:gap-2">
                  <span className="block min-w-0 flex-1 truncate text-xs text-slate-300">
                    {index + 1}. {label}
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1 sm:mt-0">
                    <Button size="sm" variant="secondary" onClick={() => onMoveImagePage(index, -1)} disabled={index === 0} aria-label={`${index + 1}번 이미지 페이지 위로 이동`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => onMoveImagePage(index, 1)} disabled={index === imagePages.length - 1} aria-label={`${index + 1}번 이미지 페이지 아래로 이동`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => onRemoveImagePage(index)} aria-label={`${index + 1}번 이미지 페이지 삭제`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-2 py-2">
            <Button size="sm" variant="secondary" onClick={onPrevious} disabled={safePage <= 1} aria-label="이전 이미지 페이지">
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              이전
            </Button>
            <span className="text-xs font-semibold text-slate-300">{safePage} / {totalPages}페이지</span>
            <Button size="sm" variant="secondary" onClick={onNext} disabled={safePage >= totalPages} aria-label="다음 이미지 페이지">
              다음
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>

          {currentImageUrl && (
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
              {imageLoadFailed ? (
                <div className="flex min-h-72 flex-col items-center justify-center gap-2 px-4 text-center" role="alert">
                  <p className="text-sm font-semibold text-rose-200">이미지를 불러오지 못했습니다.</p>
                  <p className="max-w-sm break-all text-xs leading-5 text-rose-200/70">
                    URL이 올바른지, 이미지 파일이 외부에서 열리는지 확인해 주세요: {currentImageUrl}
                  </p>
                </div>
              ) : (
                <img
                  src={currentImageUrl}
                  alt={`${characterName} 이미지 롤지 ${safePage}페이지`}
                  className="max-h-[70vh] min-h-72 w-full object-contain"
                  onError={() => setImageLoadFailed(true)}
                />
              )}
            </div>
          )}
        </>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={`text-xs ${
            saveStatus === 'failed'
              ? 'text-rose-300'
              : saveStatus === 'saved'
                ? 'text-emerald-300'
                : 'text-slate-500'
          }`}
        >
          {saveStatus === 'failed'
            ? '저장하지 못했습니다. 다시 시도해 주세요.'
            : saveStatus === 'saved'
              ? '저장되었습니다.'
              : '페이지 추가·삭제·순서 변경 후 저장해 주세요.'}
        </p>
        <Button size="sm" onClick={onSave} disabled={isPending || totalPages === 0}>
          <Save className="mr-1.5 h-3.5 w-3.5" />
          이미지 롤지 저장
        </Button>
      </div>
      {pickerOpen ? (
        <MediaPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(media) => onAddImageMediaPage(media.id)}
          themeId={themeId}
          useCase="role_sheet_image"
          title="이미지 페이지 선택"
        />
      ) : null}
    </div>
  );
}
