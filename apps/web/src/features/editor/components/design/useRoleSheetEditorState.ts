import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  useCharacterRoleSheet,
  useUpsertCharacterRoleSheet,
  type RoleSheetResponse,
} from '@/features/editor/api';
import type { MediaResponse } from '@/features/editor/mediaApi';
import { isApiHttpError } from '@/lib/api-error';

type EditableRoleSheetFormat = 'markdown' | 'pdf' | 'images';
type ResolvedRoleSheetFormat = EditableRoleSheetFormat | null;
type SaveStatus = 'idle' | 'saved' | 'failed';
export type ImageRoleSheetPageDraft =
  | { kind: 'media'; mediaId: string }
  | { kind: 'url'; url: string };

type UpsertRoleSheetMutation = ReturnType<typeof useUpsertCharacterRoleSheet>;

interface UseRoleSheetEditorStateParams {
  themeId: string;
  characterId: string;
  characterName: string;
}

export function useRoleSheetEditorState({
  characterId,
}: UseRoleSheetEditorStateParams) {
  const roleSheetQuery = useCharacterRoleSheet(characterId);
  const upsertContent = useUpsertCharacterRoleSheet(characterId);
  const [selectedFormat, setSelectedFormat] = useState<EditableRoleSheetFormat>('markdown');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [page, setPage] = useState(1);
  const manualSaveRef = useRef(false);

  const sync = useRoleSheetSync({ roleSheet: roleSheetQuery.data, roleSheetError: roleSheetQuery.error });
  const [draft, setDraft] = useState('');
  const [imagePages, setImagePages] = useState<ImageRoleSheetPageDraft[]>([]);
  const [imageDraft, setImageDraft] = useState('');
  const imageUrls = useMemo(() => imagePages.flatMap((imagePage) => imagePage.kind === 'url' ? [imagePage.url] : []), [imagePages]);
  const imageMediaIds = useMemo(() => imagePages.flatMap((imagePage) => imagePage.kind === 'media' ? [imagePage.mediaId] : []), [imagePages]);
  const [pdfMediaId, setPdfMediaId] = useState<string | undefined>(sync.pdfMediaId);

  useEffect(() => {
    setDraft(sync.originalBody);
    setSaveStatus('idle');
  }, [sync.originalBody, characterId]);

  useEffect(() => {
    setImagePages(sync.imagePages);
    setImageDraft('');
  }, [sync.imagePages, characterId]);

  useEffect(() => {
    setPdfMediaId(sync.pdfMediaId);
  }, [sync.pdfMediaId, characterId]);

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
  const savePDFMedia = useRoleSheetPdfMediaSaver({
    upsertContent,
    setSelectedFormat,
    setPage,
    setPdfMediaId,
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
    page,
    setPage,
    imageUrls,
    imageMediaIds,
    imagePages,
    imageDraft,
    setImageDraft,
    manualSaveRef,
    isMissingDocument: sync.isMissingDocument,
    isUnsupportedFormat: sync.isUnsupportedFormat,
    pdfMediaId,
    upsertContent,
    setDraft,
    saveMarkdown,
    savePDFMedia,
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

function useRoleSheetPdfMediaSaver({
  upsertContent,
  setSelectedFormat,
  setPage,
  setPdfMediaId,
}: {
  upsertContent: UpsertRoleSheetMutation;
  setSelectedFormat: (format: EditableRoleSheetFormat) => void;
  setPage: (page: number) => void;
  setPdfMediaId: (mediaId: string) => void;
}) {
  return (media: MediaResponse) => {
    if (upsertContent.isPending) return;
    if (media.type !== 'DOCUMENT' || media.mime_type !== 'application/pdf') {
      toast.error('PDF 파일만 역할지 PDF로 연결할 수 있습니다');
      return;
    }

    upsertContent.mutate(
      { format: 'pdf', pdf: { media_id: media.id } },
      {
        onSuccess: () => {
          setSelectedFormat('pdf');
          setPage(1);
          setPdfMediaId(media.id);
          toast.success('PDF 역할지가 연결되었습니다');
        },
        onError: () => {
          toast.error('PDF 역할지 연결에 실패했습니다');
        },
      },
    );
  };
}
