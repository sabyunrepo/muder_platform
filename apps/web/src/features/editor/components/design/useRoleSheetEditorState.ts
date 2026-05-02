import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import {
  useCharacterRoleSheet,
  useUpsertCharacterRoleSheet,
  type RoleSheetResponse,
} from '@/features/editor/api';
import {
  uploadMediaFile,
  useConfirmUpload,
  useRequestUploadUrl,
  type ConfirmUploadRequest,
  type MediaResponse,
  type RequestUploadUrlRequest,
  type UploadUrlResponse,
} from '@/features/editor/mediaApi';
import { isApiHttpError } from '@/lib/api-error';

type EditableRoleSheetFormat = 'markdown' | 'pdf';
type SaveStatus = 'idle' | 'saved' | 'failed';

type UpsertRoleSheetMutation = ReturnType<typeof useUpsertCharacterRoleSheet>;
type RequestUploadUrlMutation = ReturnType<typeof useRequestUploadUrl>;
type ConfirmUploadMutation = ReturnType<typeof useConfirmUpload>;

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const manualSaveRef = useRef(false);

  const sync = useRoleSheetSync({ roleSheet: roleSheetQuery.data, roleSheetError: roleSheetQuery.error });
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft(sync.originalBody);
    setSaveStatus('idle');
  }, [sync.originalBody, characterId]);

  useEffect(() => {
    setSelectedFormat(roleSheetQuery.data?.format === 'pdf' ? 'pdf' : 'markdown');
    setPage(1);
  }, [roleSheetQuery.data?.format, characterId]);

  const saveMarkdown = useRoleSheetMarkdownSaver({
    data: roleSheetQuery.data,
    draft,
    originalBody: sync.originalBody,
    upsertContent,
    setSelectedFormat,
    setSaveStatus,
  });
  const handlePDFFile = useRoleSheetPdfUploader({
    themeId,
    characterName,
    requestUploadUrl,
    confirmUpload,
    upsertContent,
    setSelectedFormat,
    setPage,
    setUploading,
    setUploadProgress,
  });

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
    isMissingDocument: sync.isMissingDocument,
    isUnsupportedFormat: sync.isUnsupportedFormat,
    pdfMediaId: sync.pdfMediaId,
    upsertContent,
    requestUploadUrl,
    confirmUpload,
    setDraft,
    saveMarkdown,
    handlePDFFile,
  };
}

function useRoleSheetSync({
  roleSheet,
  roleSheetError,
}: {
  roleSheet?: RoleSheetResponse;
  roleSheetError: unknown;
}) {
  const isMissingDocument = isApiHttpError(roleSheetError) && roleSheetError.status === 404;
  const isUnsupportedFormat = !isMissingDocument && roleSheet?.format !== undefined && roleSheet.format === 'images';
  const originalBody = isMissingDocument ? '' : (roleSheet?.markdown?.body ?? '');
  const pdfMediaId = roleSheet?.format === 'pdf' ? roleSheet.pdf?.media_id : undefined;

  return { isMissingDocument, isUnsupportedFormat, originalBody, pdfMediaId };
}

function useRoleSheetMarkdownSaver({
  data,
  draft,
  originalBody,
  upsertContent,
  setSelectedFormat,
  setSaveStatus,
}: {
  data?: RoleSheetResponse;
  draft: string;
  originalBody: string;
  upsertContent: UpsertRoleSheetMutation;
  setSelectedFormat: (format: EditableRoleSheetFormat) => void;
  setSaveStatus: (status: SaveStatus) => void;
}) {
  return (nextBody = draft) => {
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
  };
}

function useRoleSheetPdfUploader({
  themeId,
  characterName,
  requestUploadUrl,
  confirmUpload,
  upsertContent,
  setSelectedFormat,
  setPage,
  setUploading,
  setUploadProgress,
}: {
  themeId: string;
  characterName: string;
  requestUploadUrl: RequestUploadUrlMutation;
  confirmUpload: ConfirmUploadMutation;
  upsertContent: UpsertRoleSheetMutation;
  setSelectedFormat: (format: EditableRoleSheetFormat) => void;
  setPage: (page: number) => void;
  setUploading: (uploading: boolean) => void;
  setUploadProgress: (progress: number) => void;
}) {
  return async (event: ChangeEvent<HTMLInputElement>) => {
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
      const media = await uploadRoleSheetPDF({
        themeId,
        file,
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
  };
}

function uploadRoleSheetPDF({
  themeId,
  file,
  name,
  requestUploadUrl,
  confirmUpload,
  onProgress,
}: {
  themeId: string;
  file: File;
  name: string;
  requestUploadUrl: (req: RequestUploadUrlRequest) => Promise<UploadUrlResponse>;
  confirmUpload: (req: ConfirmUploadRequest) => Promise<MediaResponse>;
  onProgress: (progress: number) => void;
}) {
  return uploadMediaFile({
    themeId,
    file,
    type: 'DOCUMENT',
    name,
    mimeType: 'application/pdf',
    requestUploadUrl,
    confirmUpload,
    onProgress,
  });
}
