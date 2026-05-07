import type { ReadingLineDTO } from '../../readingApi';
import type { MediaResponse } from '../../mediaApi';
import type { CharacterOption } from './readingBlockUiTypes';

export interface BlockFieldProps {
  line: ReadingLineDTO;
  characters: CharacterOption[];
  mediaById: Map<string, MediaResponse>;
  themeId: string;
  onPatch: (patchValue: Partial<ReadingLineDTO>) => void;
}
