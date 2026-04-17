import { useState } from 'react';
import { toast } from 'sonner';
import {
  useCreateClue,
  useUpdateClue,
  type ClueResponse,
} from '@/features/editor/api';
import { mergeClueImage } from '@/features/editor/editorClueApi';
import { uploadImage } from '@/features/editor/imageApi';

// ---------------------------------------------------------------------------
// useClueFormSubmit
//
// Extracts create/update submit logic from ClueForm. Handles:
//   - create mode: mutate → optional uploadImage + mergeClueImage
//   - update mode: mutate only
//   - toast success/error for both
//   - `isUploading` flag that components can include in their `isPending`
//     state while the post-create image upload is in flight.
// ---------------------------------------------------------------------------

export interface ClueSubmitBody {
  name: string;
  description?: string;
  image_url?: string;
  level: number;
  sort_order: number;
  is_common: boolean;
  is_usable: boolean;
  use_effect?: string;
  use_target?: string;
  use_consumed?: boolean;
  reveal_round?: number | null;
  hide_round?: number | null;
}

export interface UseClueFormSubmitOptions {
  themeId: string;
  clue?: ClueResponse;
  onDone: () => void;
}

export interface UseClueFormSubmitResult {
  submit: (body: ClueSubmitBody, pendingImage: File | null) => void;
  isPending: boolean;
}

export function useClueFormSubmit({
  themeId,
  clue,
  onDone,
}: UseClueFormSubmitOptions): UseClueFormSubmitResult {
  const isEditMode = !!clue;
  const createClue = useCreateClue(themeId);
  const updateClue = useUpdateClue(themeId);
  const [isUploading, setIsUploading] = useState(false);

  function submit(body: ClueSubmitBody, pendingImage: File | null) {
    if (isEditMode && clue) {
      updateClue.mutate(
        { clueId: clue.id, body },
        {
          onSuccess: () => {
            toast.success('단서가 수정되었습니다');
            onDone();
          },
          onError: (err) => {
            toast.error(err.message || '단서 수정에 실패했습니다');
          },
        },
      );
      return;
    }

    createClue.mutate(body, {
      onSuccess: async (newClue) => {
        // If an image was selected, upload it now that we have the clue ID.
        if (pendingImage && newClue.id) {
          setIsUploading(true);
          try {
            const uploadedUrl = await uploadImage(
              themeId,
              'clue',
              newClue.id,
              pendingImage,
              pendingImage.type,
            );
            // Merge image_url into the optimistic clue entry before the
            // react-query invalidate fires; otherwise the row briefly flashes
            // with an empty image_url.
            mergeClueImage(themeId, newClue.id, uploadedUrl);
          } catch {
            toast.error('단서는 저장되었지만 이미지 업로드에 실패했습니다');
          } finally {
            setIsUploading(false);
          }
        }
        toast.success('단서가 추가되었습니다');
        onDone();
      },
      onError: (err) => {
        toast.error(err.message || '단서 추가에 실패했습니다');
      },
    });
  }

  const isPending =
    createClue.isPending || updateClue.isPending || isUploading;

  return { submit, isPending };
}
