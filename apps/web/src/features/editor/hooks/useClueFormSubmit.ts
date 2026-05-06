import { toast } from 'sonner';
import {
  useCreateClue,
  useUpdateClue,
  type ClueResponse,
} from '@/features/editor/api';

// ---------------------------------------------------------------------------
// useClueFormSubmit
//
// Extracts create/update submit logic from ClueForm. Handles:
//   - create mode: mutate
//   - update mode: mutate only
//   - toast success/error for both
// ---------------------------------------------------------------------------

export interface ClueSubmitBody {
  name: string;
  description?: string;
  image_url?: string;
  image_media_id?: string | null;
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
  submit: (body: ClueSubmitBody) => void;
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

  function submit(body: ClueSubmitBody) {
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
      onSuccess: () => {
        toast.success('단서가 추가되었습니다');
        onDone();
      },
      onError: (err) => {
        toast.error(err.message || '단서 추가에 실패했습니다');
      },
    });
  }

  const isPending = createClue.isPending || updateClue.isPending;

  return { submit, isPending };
}
