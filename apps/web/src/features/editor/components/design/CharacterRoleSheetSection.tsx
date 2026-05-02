import { ChevronLeft, ChevronRight, FileText, FileUp, Save } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { Spinner } from '@/shared/components/ui/Spinner';
import { useMediaDownloadUrl } from '@/features/editor/mediaApi';
import { ImageRoleSheetPanel } from './ImageRoleSheetPanel';
import { useRoleSheetEditorState } from './useRoleSheetEditorState';

interface CharacterRoleSheetSectionProps {
  themeId: string;
  characterId: string;
  characterName: string;
}

export function CharacterRoleSheetSection({
  themeId,
  characterId,
  characterName,
}: CharacterRoleSheetSectionProps) {
  const state = useRoleSheetEditorState({ themeId, characterId, characterName });
  const { isError, isLoading, refetch } = state.roleSheetQuery;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  if (isError && !state.isMissingDocument) {
    return (
      <section
        className="space-y-3 rounded-lg border border-rose-900/60 bg-rose-950/20 p-4"
        aria-label={`${characterName} 역할지 오류`}
      >
        <p className="text-sm font-semibold text-rose-200">역할지를 불러오지 못했습니다.</p>
        <p className="text-xs leading-5 text-rose-200/70">
          네트워크 또는 서버 응답을 확인한 뒤 다시 시도해 주세요.
        </p>
        <Button size="sm" variant="secondary" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </section>
    );
  }

  if (state.isUnsupportedFormat) {
    return <UnsupportedRoleSheetFormatNotice characterName={characterName} />;
  }

  return (
    <section className="space-y-3" aria-label={`${characterName} 역할지`}>
      <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/80" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-300">역할지 형식</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            플레이어에게만 보이는 비밀·동기·알리바이를 Markdown, PDF, 이미지 페이지 중 하나로 제공합니다.
          </p>
        </div>
      </div>

      <RoleSheetFormatSelector
        selectedFormat={state.selectedFormat}
        onFormatChange={state.setSelectedFormat}
      />

      {state.selectedFormat === 'pdf' ? (
        <PDFRoleSheetPanel
          characterName={characterName}
          mediaId={state.pdfMediaId}
          page={state.page}
          uploading={state.uploading || state.requestUploadUrl.isPending || state.confirmUpload.isPending || state.upsertContent.isPending}
          uploadProgress={state.uploadProgress}
          onPrevious={() => state.setPage((current) => Math.max(1, current - 1))}
          onNext={() => state.setPage((current) => current + 1)}
          onUploadClick={() => state.fileInputRef.current?.click()}
        />
      ) : state.selectedFormat === 'images' ? (
        <ImageRoleSheetPanel
          characterName={characterName}
          imageUrls={state.imageUrls}
          imageDraft={state.imageDraft}
          page={state.page}
          saveStatus={state.saveStatus}
          isPending={state.upsertContent.isPending}
          onImageDraftChange={state.setImageDraft}
          onAddImagePage={state.addImagePage}
          onRemoveImagePage={state.removeImagePage}
          onMoveImagePage={state.moveImagePage}
          onPrevious={() => state.setPage((current) => Math.max(1, current - 1))}
          onNext={() => state.setPage((current) => Math.min(state.imageUrls.length, current + 1))}
          onSave={state.saveImages}
        />
      ) : (
        <MarkdownRoleSheetEditor
          characterName={characterName}
          draft={state.draft}
          saveStatus={state.saveStatus}
          isMissingDocument={state.isMissingDocument}
          isPending={state.upsertContent.isPending}
          onDraftChange={(next) => {
            state.setDraft(next);
            state.setSaveStatus('idle');
          }}
          onBlur={(relatedTarget) => {
            if (isSaveButtonTarget(relatedTarget)) {
              state.manualSaveRef.current = true;
              return;
            }
            if (state.manualSaveRef.current) return;
            state.saveMarkdown(state.draft);
          }}
          onSaveMouseDown={() => {
            state.manualSaveRef.current = true;
          }}
          onSaveKeyDown={() => {
            state.manualSaveRef.current = true;
          }}
          onSave={() => {
            state.saveMarkdown(state.draft);
            window.setTimeout(() => {
              state.manualSaveRef.current = false;
            }, 0);
          }}
          onSaveBlur={() => {
            state.manualSaveRef.current = false;
          }}
        />
      )}

      <input
        ref={state.fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => void state.handlePDFFile(event)}
        aria-label="PDF 역할지 파일 선택"
      />
    </section>
  );
}


function UnsupportedRoleSheetFormatNotice({ characterName }: { characterName: string }) {
  return (
    <section
      className="space-y-3 rounded-lg border border-amber-900/60 bg-amber-950/20 p-4"
      aria-label={`${characterName} 지원하지 않는 역할지 형식`}
    >
      <p className="text-sm font-semibold text-amber-100">지원하지 않는 역할지 형식입니다.</p>
      <p className="text-xs leading-5 text-amber-100/70">
        현재 에디터에서 안전하게 편집할 수 없는 형식이라 덮어쓰기를 막았습니다. Markdown, PDF, 이미지 롤지 중 하나로 변환한 뒤 다시 편집해 주세요.
      </p>
    </section>
  );
}

function isSaveButtonTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest('[data-role-sheet-save="true"]') !== null;
}

function RoleSheetFormatSelector({
  selectedFormat,
  onFormatChange,
}: {
  selectedFormat: 'markdown' | 'pdf' | 'images';
  onFormatChange: (format: 'markdown' | 'pdf' | 'images') => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="역할지 형식 선택">
      <FormatButton
        label="Markdown"
        description="텍스트로 빠르게 작성"
        active={selectedFormat === 'markdown'}
        onClick={() => onFormatChange('markdown')}
      />
      <FormatButton
        label="PDF"
        description="업로드 후 페이지 단위 보기"
        active={selectedFormat === 'pdf'}
        onClick={() => onFormatChange('pdf')}
      />
      <FormatButton
        label="이미지"
        description="여러 장을 순서대로 보기"
        active={selectedFormat === 'images'}
        onClick={() => onFormatChange('images')}
      />
    </div>
  );
}

function FormatButton({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
        active
          ? 'border-amber-500/70 bg-amber-500/10 text-amber-100'
          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
      }`}
    >
      <span className="block text-xs font-semibold">{label}</span>
      <span className="mt-1 block text-[11px] leading-4 text-slate-500">{description}</span>
    </button>
  );
}

function MarkdownRoleSheetEditor({
  characterName,
  draft,
  saveStatus,
  isMissingDocument,
  isPending,
  onDraftChange,
  onBlur,
  onSaveMouseDown,
  onSaveKeyDown,
  onSave,
  onSaveBlur,
}: {
  characterName: string;
  draft: string;
  saveStatus: 'idle' | 'saved' | 'failed';
  isMissingDocument: boolean;
  isPending: boolean;
  onDraftChange: (body: string) => void;
  onBlur: (relatedTarget: EventTarget | null) => void;
  onSaveMouseDown: () => void;
  onSaveKeyDown: () => void;
  onSave: () => void;
  onSaveBlur: () => void;
}) {
  return (
    <div className="space-y-3">
      <textarea
        aria-label="역할지 Markdown"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={(event) => onBlur(event.relatedTarget)}
        placeholder={`## ${characterName}의 정체\n\n## 비밀\n\n## 동기\n\n## 알리바이`}
        className="min-h-64 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs leading-5 text-slate-200 placeholder:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
      />

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
              : isMissingDocument
                ? '아직 저장된 역할지가 없습니다.'
                : '수정 후 포커스를 벗어나면 자동 저장됩니다.'}
        </p>
        <Button
          size="sm"
          data-role-sheet-save="true"
          onMouseDown={onSaveMouseDown}
          onKeyDown={onSaveKeyDown}
          onClick={onSave}
          onBlur={onSaveBlur}
          disabled={isPending}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          역할지 저장
        </Button>
      </div>
    </div>
  );
}

function PDFRoleSheetPanel({
  characterName,
  mediaId,
  page,
  uploading,
  uploadProgress,
  onPrevious,
  onNext,
  onUploadClick,
}: {
  characterName: string;
  mediaId?: string;
  page: number;
  uploading: boolean;
  uploadProgress: number;
  onPrevious: () => void;
  onNext: () => void;
  onUploadClick: () => void;
}) {
  const { data, isLoading, isError, refetch } = useMediaDownloadUrl(mediaId);
  const viewerUrl = data?.url ? `${data.url}#page=${page}&toolbar=0&navpanes=0&view=FitH` : undefined;

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-300">PDF 역할지</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">모바일에서도 한 페이지씩 넘겨 읽을 수 있게 표시합니다.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onUploadClick} disabled={uploading}>
          <FileUp className="mr-1.5 h-3.5 w-3.5" />
          {mediaId ? 'PDF 교체' : 'PDF 업로드'}
        </Button>
      </div>

      {uploading && (
        <p className="rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
          PDF 업로드 중입니다{uploadProgress > 0 ? ` (${uploadProgress}%)` : ''}.
        </p>
      )}

      {!mediaId ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 p-6 text-center">
          <p className="text-sm font-semibold text-slate-300">아직 연결된 PDF가 없습니다.</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{characterName} 플레이어가 받을 역할지 PDF를 업로드해 주세요.</p>
        </div>
      ) : isLoading ? (
        <div className="flex min-h-72 items-center justify-center" role="status" aria-label="PDF 역할지 로딩 중">
          <Spinner size="sm" />
        </div>
      ) : isError || !viewerUrl ? (
        <div className="space-y-3 rounded-lg border border-rose-900/50 bg-rose-950/20 p-4">
          <p className="text-sm font-semibold text-rose-200">PDF를 불러오지 못했습니다.</p>
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>다시 시도</Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-2 py-2">
            <Button size="sm" variant="secondary" onClick={onPrevious} disabled={page <= 1}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              이전
            </Button>
            <span className="text-xs font-semibold text-slate-300">{page}페이지</span>
            <Button size="sm" variant="secondary" onClick={onNext}>
              다음
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-white">
            <iframe
              key={viewerUrl}
              title={`${characterName} PDF 역할지 ${page}페이지`}
              src={viewerUrl}
              className="h-[70vh] min-h-[420px] w-full"
            />
          </div>
        </>
      )}
    </div>
  );
}
