import { useState, useEffect, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/shared/components/ui/Modal';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import {
  useCreateCharacter,
  useUpdateCharacter,
  type EditorCharacterResponse,
} from '@/features/editor/api';

interface CharacterFormProps {
  themeId: string;
  character?: EditorCharacterResponse;
  isOpen: boolean;
  onClose: () => void;
}

export function CharacterForm({ themeId, character, isOpen, onClose }: CharacterFormProps) {
  const isEditMode = !!character;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCulprit, setIsCulprit] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createCharacter = useCreateCharacter(themeId);
  const updateCharacter = useUpdateCharacter(themeId);

  useEffect(() => {
    if (isOpen) {
      if (character) {
        setName(character.name);
        setDescription(character.description ?? '');
        setIsCulprit(character.is_culprit);
        setSortOrder(character.sort_order);
      } else {
        setName('');
        setDescription('');
        setIsCulprit(false);
        setSortOrder(0);
      }
      setErrors({});
    }
  }, [isOpen, character]);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      next.name = '이름은 필수입니다';
    } else if (trimmedName.length > 50) {
      next.name = '이름은 50자 이하여야 합니다';
    }

    if (isEditMode && description.length > 2000) {
      next.description = '설명은 2000자 이하여야 합니다';
    }

    return next;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    if (isEditMode) {
      const nextMysteryRole = isCulprit
        ? 'culprit'
        : character.mystery_role === 'culprit'
          ? 'suspect'
          : character.mystery_role;

      updateCharacter.mutate(
        {
          characterId: character.id,
          body: {
            name: name.trim(),
            description: description || undefined,
            image_url: character.image_url ?? undefined,
            image_media_id: character.image_media_id ?? undefined,
            is_culprit: isCulprit,
            sort_order: sortOrder,
            mystery_role: nextMysteryRole,
            is_playable: character.is_playable,
            show_in_intro: character.show_in_intro,
            can_speak_in_reading: character.can_speak_in_reading,
            is_voting_candidate: character.is_voting_candidate,
            endcard_title: character.endcard_title ?? undefined,
            endcard_body: character.endcard_body ?? undefined,
            endcard_image_url: character.endcard_image_url ?? undefined,
            endcard_image_media_id: character.endcard_image_media_id ?? undefined,
          },
        },
        {
          onSuccess: () => {
            toast.success('캐릭터가 수정되었습니다');
            onClose();
          },
          onError: (err) => {
            toast.error(err.message || '캐릭터 수정에 실패했습니다');
          },
        },
      );
    } else {
      createCharacter.mutate(
        {
          name: name.trim(),
        },
        {
          onSuccess: () => {
            toast.success('캐릭터가 추가되었습니다');
            onClose();
          },
          onError: (err) => {
            toast.error(err.message || '캐릭터 추가에 실패했습니다');
          },
        },
      );
    }
  }

  const isPending = createCharacter.isPending || updateCharacter.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? '캐릭터 수정' : '캐릭터 추가'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            취소
          </Button>
          <Button type="submit" form="character-form" isLoading={isPending}>
            저장
          </Button>
        </>
      }
    >
      <form id="character-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="캐릭터 이름"
          required
          maxLength={50}
          error={errors.name}
        />

        {isEditMode && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="character-description" className="text-sm font-medium text-slate-300">
                설명
              </label>
              <textarea
                id="character-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="캐릭터에 대한 설명"
                maxLength={2000}
                rows={3}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
              />
              {errors.description && (
                <p className="text-sm text-red-400">{errors.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                id="character-is-culprit"
                type="checkbox"
                checked={isCulprit}
                onChange={(e) => setIsCulprit(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
              />
              <label htmlFor="character-is-culprit" className="text-sm font-medium text-slate-300">
                범인 여부
              </label>
            </div>

            <Input
              label="정렬 순서"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              min={0}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
