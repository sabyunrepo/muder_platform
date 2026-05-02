import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { useCharacterRoleSheet, useUpsertCharacterRoleSheet } from '@/features/editor/api';
import {
  uploadMediaFile,
  useConfirmUpload,
  useRequestUploadUrl,
} from '@/features/editor/mediaApi';
import { isApiHttpError } from '@/lib/api-error';

type EditableRoleSheetFormat = 'markdown' | 'pdf';

interface UseRoleSheetEditorStateParams {
  themeId: string;
  characterId: string;
  characterName: string;
}

export function useRoleSheetEditorState({
  themeId,
  characterId,
  characterName,
}: UseRoleSheetEditorStateParams) {
  const roleSheetQuery = useCharacterRoleSheet(characterId);
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
  const { data, error, isError } = roleSheetQuery;
  const isMissingDocument = isApiHttpError(error) && error.status === 404;
  const isUnsupportedFormat = !isMissingDocument && data?.format !== undefined && data.format === 'images';
  const originalBody = isMissingDocument ? '' : (data?.markdown?.body ?? '');
  const pdfMediaId = data?.format === 'pdf' ? data.pdf?.media_id : undefined;

  useEffect(() => {
    if (!isError || isMissingDocument) setDraft(originalBody);
    setSaveStatus('idle');
  }, [characterId, isError, isMissingDocument, originalBody]);

  useEffect(() => {
    setSelectedFormat(data?.format === 'pdf' ? 'pdf' : 'markdown');
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
    const looksLikePDF = file.type === 'application/pdf' || (!file.type && /\.pdf$/i.test(file.name));
    if (!looksLikePDF) {
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
        mimeType: 'application/pdf',
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

  return {
    roleSheetQuery,
    selectedFormat,
    setSelectedFormat,
    draft,
    saveStatus,
    setSaveStatus,
    uploading,
    uploadProgress,
    page,
    setPage,
    fileInputRef,
    manualSaveRef,
    isMissingDocument,
    isUnsupportedFormat,
    pdfMediaId,
    upsertContent,
    requestUploadUrl,
    confirmUpload,
    setDraft,
    saveMarkdown,
    handlePDFFile,
  };
}
