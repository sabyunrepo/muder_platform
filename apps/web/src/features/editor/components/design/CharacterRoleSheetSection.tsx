import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ChevronLeft, ChevronRight, FileText, FileUp, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/Button';
import { Spinner } from '@/shared/components/ui/Spinner';
import { useCharacterRoleSheet, useUpsertCharacterRoleSheet } from '@/features/editor/api';
import {
  uploadMediaFile,
  useConfirmUpload,
  useMediaDownloadUrl,
  useRequestUploadUrl,
} from '@/features/editor/mediaApi';
import { isApiHttpError } from '@/lib/api-error';

interface CharacterRoleSheetSectionProps {
  themeId: string;
  characterId: string;
  characterName: string;
}

type EditableRoleSheetFormat = 'markdown' | 'pdf';

export function CharacterRoleSheetSection({
  themeId,
  characterId,
  characterName,
}: CharacterRoleSheetSectionProps) {
  const {
    data,
    error,
    isError,
    isLoading,
    refetch,
  } = useCharacterRoleSheet(characterId);
  const upsertContent = useUpsertCharacterRoleSheet(characterId);
  const requestUploadUrl = useRequestUploadUrl(themeId);
  const confirmUpload = useConfirmUpload(themeId);
  const [selectedFormat, setSelectedFormat] = useState<EditableRoleSheetFormat>('markdown');
  const [draft, setDraft] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const manualSaveRef = useRef(false);
  const isMissingDocument = isApiHttpError(error) && error.status === 404;
  const isUnsupportedFormat = !isMissingDocument && data?.format !== undefined && data.format === 'images';
  const originalBody = isMissingDocument ? '' : (data?.markdown?.body ?? '');
  const pdfMediaId = data?.format === 'pdf' ? data.pdf?.media_id : undefined;

  useEffect(() => {
    if (!isError || isMissingDocument) setDraft(originalBody);
    setSaveStatus('idle');
  }, [characterId, isError, isMissingDocument, originalBody]);

  useEffect(() => {
    if (data?.format === 'pdf') setSelectedFormat('pdf');
    else setSelectedFormat('markdown');
    setPage(1);
  }, [data?.format, characterId]);

  function saveMarkdown(nextBody = draft) {
    if (upsertContent.isPending) return;
    if (originalBody === nextBody && data?.format === 'markdown') {
      setSaveStatus('saved');
      return;
    }

    upsertContent.mutate(
      { format: 'markdown', markdown: { body: nextBody } },
      {
        onSuccess: () => {
          setSelectedFormat('markdown');
          setSaveStatus('saved');
          toast.success('역할지가 저장되었습니다');
        },
        onError: () => {
          setSaveStatus('failed');
          toast.error('역할지 저장에 실패했습니다');
        },
      },
    );
  }

  async function handlePDFFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('PDF 파일만 업로드할 수 있습니다');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const media = await uploadMediaFile({
        themeId,
        file,
        type: 'DOCUMENT',
        name: file.name.replace(/\.pdf$/i, '') || `${characterName} 역할지`,
        requestUploadUrl: (req) => requestUploadUrl.mutateAsync(req),
        confirmUpload: (req) => confirmUpload.mutateAsync(req),
        onProgress: setUploadProgress,
      });
      upsertContent.mutate(
        { format: 'pdf', pdf: { media_id: media.id } },
        {
          onSuccess: () => {
            setSelectedFormat('pdf');
            setPage(1);
            toast.success('PDF 역할지가 연결되었습니다');
          },
          onError: () => {
            toast.error('PDF 역할지 연결에 실패했습니다');
          },
        },
      );
    } catch {
      toast.error('PDF 업로드에 실패했습니다');
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  if (isError && !isMissingDocument) {
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

  if (isUnsupportedFormat) {
    return <UnsupportedRoleSheetFormatNotice characterName={characterName} />;
  }

  return (
    <section className="space-y-3" aria-label={`${characterName} 역할지`}>
      <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/80" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-300">역할지 형식</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            플레이어에게만 보이는 비밀·동기·알리바이를 Markdown 또는 PDF 한 페이지씩 읽는 방식으로 제공합니다.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="역할지 형식 선택">
        <FormatButton
          label="Markdown"
          description="텍스트로 빠르게 작성"
          active={selectedFormat === 'markdown'}
          onClick={() => setSelectedFormat('markdown')}
        />
        <FormatButton
          label="PDF"
          description="업로드 후 페이지 단위 보기"
          active={selectedFormat === 'pdf'}
          onClick={() => setSelectedFormat('pdf')}
        />
        <button
          type="button"
          disabled
          className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-left opacity-60"
        >
          <span className="block text-xs font-semibold text-slate-400">이미지</span>
          <span className="mt-1 block text-[11px] leading-4 text-slate-600">다음 PR에서 여러 장 순서 보기 지원</span>
        </button>
      </div>

      {selectedFormat === 'pdf' ? (
        <PDFRoleSheetPanel
          characterName={characterName}
          mediaId={pdfMediaId}
          page={page}
          uploading={uploading || requestUploadUrl.isPending || confirmUpload.isPending || upsertContent.isPending}
          uploadProgress={uploadProgress}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
          onUploadClick={() => fileInputRef.current?.click()}
        />
      ) : (
        <MarkdownRoleSheetEditor
          characterName={characterName}
          draft={draft}
          saveStatus={saveStatus}
          isMissingDocument={isMissingDocument}
          isPending={upsertContent.isPending}
          onDraftChange={(next) => {
            setDraft(next);
            setSaveStatus('idle');
          }}
          onBlur={() => {
            if (manualSaveRef.current) return;
            saveMarkdown(draft);
          }}
          onSaveMouseDown={() => {
            manualSaveRef.current = true;
          }}
          onSave={() => {
            saveMarkdown(draft);
            window.setTimeout(() => {
              manualSaveRef.current = false;
            }, 0);
          }}
          onSaveBlur={() => {
            manualSaveRef.current = false;
          }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(event) => void handlePDFFile(event)}
        aria-label="PDF 역할지 파일 선택"
      />
    </section>
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
  onSave,
  onSaveBlur,
}: {
  characterName: string;
  draft: string;
  saveStatus: 'idle' | 'saved' | 'failed';
  isMissingDocument: boolean;
  isPending: boolean;
  onDraftChange: (body: string) => void;
  onBlur: () => void;
  onSaveMouseDown: () => void;
  onSave: () => void;
  onSaveBlur: () => void;
}) {
  return (
    <div className="space-y-3">
      <textarea
        aria-label="역할지 Markdown"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={onBlur}
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
          onMouseDown={onSaveMouseDown}
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

function UnsupportedRoleSheetFormatNotice({ characterName }: { characterName: string }) {
  return (
    <section
      className="space-y-3 rounded-lg border border-amber-900/60 bg-amber-950/20 p-4"
      aria-label={`${characterName} 역할지 미지원 형식`}
    >
      <p className="text-sm font-semibold text-amber-100">아직 지원하지 않는 역할지 형식입니다.</p>
      <p className="text-xs leading-5 text-amber-100/70">
        이미지 역할지는 다음 PR에서 여러 장을 순서대로 보는 전용 뷰어로 연결됩니다.
      </p>
    </section>
  );
}
