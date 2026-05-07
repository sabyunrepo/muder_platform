import { useMemo, useState } from 'react';
import { AlertTriangle, FileInput, X } from 'lucide-react';

import {
  parseReadingScriptToBlocks,
  type ReadingParseIssue,
  type ReadingParserCharacter,
  type ReadingParserMedia,
} from '../../entities/story/readingBlockAdapter';
import type { ReadingLineDTO } from '../../readingApi';

interface ReadingScriptImportModalProps {
  open: boolean;
  hasExistingBlocks: boolean;
  characters: ReadingParserCharacter[];
  media: ReadingParserMedia[];
  onClose: () => void;
  onApply: (blocks: ReadingLineDTO[]) => void;
}

const sampleScript = [
  '나레이션: 모두 눈을 감아주세요.',
  '이미지: 저택 전경 large',
  '변상훈: 저는 아무것도 보지 못했습니다.',
  'BGM: 심문 테마 반복',
  'GM: 다음 장면 준비',
].join('\n');

export function ReadingScriptImportModal({
  open,
  hasExistingBlocks,
  characters,
  media,
  onClose,
  onApply,
}: ReadingScriptImportModalProps) {
  const [script, setScript] = useState('');
  const [confirmedOverwrite, setConfirmedOverwrite] = useState(false);
  const result = useMemo(
    () => parseReadingScriptToBlocks(script, { characters, media }),
    [characters, media, script]
  );
  const canApply = result.blocks.length > 0 && (!hasExistingBlocks || confirmedOverwrite);

  if (!open) return null;

  function handleApply() {
    if (!canApply) return;
    onApply(result.blocks);
    setScript('');
    setConfirmedOverwrite(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-script-import-title"
        className="w-full max-w-4xl rounded border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-amber-300">
              <FileInput className="h-3.5 w-3.5" />
              대본 입력
            </p>
            <h3
              id="reading-script-import-title"
              className="mt-1 text-base font-semibold text-slate-100"
            >
              붙여넣은 대본을 블록으로 변환
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="대본 입력 닫기"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-3">
            <textarea
              aria-label="대본 입력 내용"
              className="min-h-80 w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-3 font-mono text-sm leading-6 text-slate-100"
              value={script}
              onChange={(event) => setScript(event.target.value)}
              placeholder={sampleScript}
            />
            {hasExistingBlocks && (
              <label className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-amber-300 bg-slate-950"
                  checked={confirmedOverwrite}
                  onChange={(event) => setConfirmedOverwrite(event.target.checked)}
                />
                현재 블록을 대본 입력 결과로 교체합니다.
              </label>
            )}
          </div>

          <aside className="space-y-3">
            <Summary count={result.blocks.length} issues={result.issues} />
            <div className="rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs leading-5 text-slate-400">
              <p className="font-medium text-slate-200">지원 형식</p>
              <p className="mt-1">화자: 대사</p>
              <p>이미지: 미디어명</p>
              <p>영상: 미디어명</p>
              <p>BGM: 미디어명 반복 / 1회 / 정지</p>
              <p>GM: 진행자 메모</p>
            </div>
          </aside>
        </div>

        <footer className="flex flex-col gap-2 border-t border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          >
            블록으로 적용
          </button>
        </footer>
      </section>
    </div>
  );
}

function Summary({ count, issues }: { count: number; issues: ReadingParseIssue[] }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/60 px-3 py-2">
      <p className="text-sm font-medium text-slate-100">미리보기</p>
      <p className="mt-1 text-xs text-slate-400">{count}개 블록으로 변환됩니다.</p>
      {issues.length > 0 && (
        <div className="mt-3 space-y-1 text-xs text-amber-200">
          <p className="flex items-center gap-1 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            확인 필요
          </p>
          {issues.slice(0, 5).map((issue) => (
            <p key={`${issue.lineNumber}-${issue.kind}-${issue.value}`}>
              {issue.lineNumber}행: {issueLabel(issue)}
            </p>
          ))}
          {issues.length > 5 && <p>외 {issues.length - 5}개</p>}
        </div>
      )}
    </div>
  );
}

function issueLabel(issue: ReadingParseIssue): string {
  if (issue.kind === 'unknown-speaker') return `화자 "${issue.value}" 선택 필요`;
  if (issue.kind === 'unknown-media') return `미디어 "${issue.value}" 선택 필요`;
  return '형식을 확인해야 합니다';
}
