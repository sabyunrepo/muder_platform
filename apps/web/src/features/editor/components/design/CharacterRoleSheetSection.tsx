import { useEffect, useState } from 'react';
import { FileText, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/Button';
import { Spinner } from '@/shared/components/ui/Spinner';
import { useEditorContent, useUpsertContent } from '@/features/editor/api';

interface CharacterRoleSheetSectionProps {
  themeId: string;
  characterId: string;
  characterName: string;
}

export function roleSheetContentKey(characterId: string) {
  return `role_sheet:${characterId}`;
}

export function CharacterRoleSheetSection({
  themeId,
  characterId,
  characterName,
}: CharacterRoleSheetSectionProps) {
  const contentKey = roleSheetContentKey(characterId);
  const { data, isLoading } = useEditorContent(themeId, contentKey);
  const upsertContent = useUpsertContent(themeId, contentKey);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setDraft(data?.body ?? '');
  }, [data?.body, characterId]);

  function save() {
    upsertContent.mutate(
      { body: draft },
      {
        onSuccess: () => toast.success('역할지가 저장되었습니다'),
        onError: () => toast.error('역할지 저장에 실패했습니다'),
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
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if ((data?.body ?? '') !== draft) save();
        }}
        placeholder={`## ${characterName}의 정체\n\n## 비밀\n\n## 동기\n\n## 알리바이`}
        className="min-h-64 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs leading-5 text-slate-200 placeholder:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
      />

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={upsertContent.isPending}>
          <Save className="mr-1.5 h-3.5 w-3.5" />
          역할지 저장
        </Button>
      </div>
    </section>
  );
}
