import { useEffect, useRef, useState } from 'react';
import { FileText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/Button';
import { Spinner } from '@/shared/components/ui/Spinner';
import { useCharacterRoleSheet, useUpsertCharacterRoleSheet } from '@/features/editor/api';
import { isApiHttpError } from '@/lib/api-error';

interface CharacterRoleSheetSectionProps {
  characterId: string;
  characterName: string;
}

export function CharacterRoleSheetSection({
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
  const [draft, setDraft] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const manualSaveRef = useRef(false);
  const isMissingDocument = isApiHttpError(error) && error.status === 404;
  const isUnsupportedFormat = !isMissingDocument && data?.format !== undefined && data.format !== 'markdown';
  const originalBody = isMissingDocument ? '' : (data?.markdown?.body ?? '');

  useEffect(() => {
    if (!isError || isMissingDocument) setDraft(originalBody);
    setSaveStatus('idle');
  }, [characterId, isError, isMissingDocument, originalBody]);

  function save(nextBody = draft) {
    if (upsertContent.isPending) return;
    if (originalBody === nextBody) {
      setSaveStatus('saved');
      return;
    }

    upsertContent.mutate(
      { format: 'markdown', markdown: { body: nextBody } },
      {
        onSuccess: () => {
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
    return (
      <section
        className="space-y-3 rounded-lg border border-amber-900/60 bg-amber-950/20 p-4"
        aria-label={`${characterName} 역할지 미지원 형식`}
      >
        <p className="text-sm font-semibold text-amber-100">아직 지원하지 않는 역할지 형식입니다.</p>
        <p className="text-xs leading-5 text-amber-100/70">
          현재 에디터는 Markdown 역할지만 편집할 수 있습니다. PDF/이미지 역할지는 다음 단계에서 전용 뷰어로 연결됩니다.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label={`${characterName} 역할지`}>
      <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/80" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-300">역할지 Markdown</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            게임 시작 시 이 캐릭터를 맡은 플레이어에게만 보이는 비밀·동기·알리바이를 작성합니다.
          </p>
        </div>
      </div>

      <textarea
        aria-label="역할지 Markdown"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setSaveStatus('idle');
        }}
        onBlur={() => {
          if (manualSaveRef.current) return;
          save(draft);
        }}
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
          onMouseDown={() => {
            manualSaveRef.current = true;
          }}
          onClick={() => {
            save(draft);
            window.setTimeout(() => {
              manualSaveRef.current = false;
            }, 0);
          }}
          onBlur={() => {
            manualSaveRef.current = false;
          }}
          disabled={upsertContent.isPending}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          역할지 저장
        </Button>
      </div>
    </section>
  );
}
