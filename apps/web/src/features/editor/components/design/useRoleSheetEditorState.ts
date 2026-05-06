import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
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

type EditableRoleSheetFormat = 'markdown' | 'pdf' | 'images';
type ResolvedRoleSheetFormat = EditableRoleSheetFormat | null;
type SaveStatus = 'idle' | 'saved' | 'failed';
export type ImageRoleSheetPageDraft =
  | { kind: 'media'; mediaId: string }
  | { kind: 'url'; url: string };

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
  const [imagePages, setImagePages] = useState<ImageRoleSheetPageDraft[]>([]);
  const [imageDraft, setImageDraft] = useState('');
  const imageUrls = useMemo(() => imagePages.flatMap((imagePage) => imagePage.kind === 'url' ? [imagePage.url] : []), [imagePages]);
  const imageMediaIds = useMemo(() => imagePages.flatMap((imagePage) => imagePage.kind === 'media' ? [imagePage.mediaId] : []), [imagePages]);

  useEffect(() => {
    setDraft(sync.originalBody);
    setSaveStatus('idle');
  }, [sync.originalBody, characterId]);

  useEffect(() => {
    setImagePages(sync.imagePages);
    setImageDraft('');
  }, [sync.imagePages, characterId]);

  useEffect(() => {
    const nextFormat = resolveEditableFormat(roleSheetQuery.data?.format);
    if (nextFormat) {
      setSelectedFormat(nextFormat);
    }
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
  const saveImages = useRoleSheetImagesSaver({
    imagePages,
    upsertContent,
    setSelectedFormat,
    setSaveStatus,
    setPage,
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
    imageUrls,
    imageMediaIds,
    imagePages,
    imageDraft,
    setImageDraft,
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
    addImagePage: () => {
      const nextURL = imageDraft.trim();
      if (!isValidWebURL(nextURL)) {
        toast.error('http 또는 https 이미지 URL을 입력해 주세요');
        return;
      }
      setImagePages((current) => {
        setPage(current.length + 1);
        return [...current, { kind: 'url', url: nextURL }];
      });
      setImageDraft('');
      setSaveStatus('idle');
    },
    addImageMediaPage: (mediaId: string) => {
      setImagePages((current) => {
        if (current.some((imagePage) => imagePage.kind === 'media' && imagePage.mediaId === mediaId)) return current;
        setPage(current.length + 1);
        return [...current, { kind: 'media', mediaId }];
      });
      setSaveStatus('idle');
    },
    removeImagePage: (index: number) => {
      setImagePages((current) => {
        const next = current.filter((_, currentIndex) => currentIndex !== index);
        setPage((currentPage) => {
          if (currentPage > index + 1) return currentPage - 1;
          if (currentPage === index + 1) return Math.max(1, Math.min(currentPage, next.length));
          return Math.max(1, Math.min(currentPage, next.length || 1));
        });
        return next;
      });
      setSaveStatus('idle');
    },
    moveImagePage: (index: number, direction: -1 | 1) => {
      setImagePages((current) => {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= current.length) return current;
        const next = [...current];
        [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
        setPage((currentPage) => {
          const currentIndex = currentPage - 1;
          if (currentIndex === index) return nextIndex + 1;
          if (currentIndex === nextIndex) return index + 1;
          return currentPage;
        });
        return next;
      });
      setSaveStatus('idle');
    },
    saveImages,
  };
}

function resolveEditableFormat(format?: string): ResolvedRoleSheetFormat {
  if (!format || format === 'markdown') return 'markdown';
  if (format === 'pdf' || format === 'images') return format;
  return null;
}

function useRoleSheetSync({
  roleSheet,
  roleSheetError,
}: {
  roleSheet?: RoleSheetResponse;
  roleSheetError: unknown;
}) {
  const isMissingDocument = isApiHttpError(roleSheetError) && roleSheetError.status === 404;
  const isUnsupportedFormat = Boolean(roleSheet?.format && !resolveEditableFormat(roleSheet.format));
  const originalBody = isMissingDocument ? '' : (roleSheet?.markdown?.body ?? '');
  const pdfMediaId = roleSheet?.format === 'pdf' ? roleSheet.pdf?.media_id : undefined;
  const imagePages = useMemo<ImageRoleSheetPageDraft[]>(() => {
    if (roleSheet?.format !== 'images') return [];
    return [
      ...(roleSheet.images?.image_media_ids ?? []).map((mediaId) => ({ kind: 'media' as const, mediaId })),
      ...(roleSheet.images?.image_urls ?? []).map((url) => ({ kind: 'url' as const, url })),
    ];
  }, [roleSheet?.format, roleSheet?.images?.image_media_ids, roleSheet?.images?.image_urls]);

  return { isMissingDocument, isUnsupportedFormat, originalBody, pdfMediaId, imagePages };
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

function useRoleSheetImagesSaver({
  imagePages,
  upsertContent,
  setSelectedFormat,
  setSaveStatus,
  setPage,
}: {
  imagePages: ImageRoleSheetPageDraft[];
  upsertContent: UpsertRoleSheetMutation;
  setSelectedFormat: (format: EditableRoleSheetFormat) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setPage: (page: number) => void;
}) {
  return () => {
    if (upsertContent.isPending) return;
    const imageUrls = imagePages.flatMap((imagePage) => imagePage.kind === 'url' ? [imagePage.url] : []);
    const imageMediaIds = imagePages.flatMap((imagePage) => imagePage.kind === 'media' ? [imagePage.mediaId] : []);
    if (imageUrls.length === 0 && imageMediaIds.length === 0) {
      setSaveStatus('failed');
      toast.error('이미지 페이지를 1개 이상 추가해 주세요');
      return;
    }

    upsertContent.mutate(
      { format: 'images', images: { image_urls: imageUrls, image_media_ids: imageMediaIds } },
      {
        onSuccess: () => {
          setSelectedFormat('images');
          setPage(1);
          setSaveStatus('saved');
          toast.success('이미지 롤지가 저장되었습니다');
        },
        onError: () => {
          setSaveStatus('failed');
          toast.error('이미지 롤지 저장에 실패했습니다');
        },
      },
    );
  };
}

function isValidWebURL(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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
