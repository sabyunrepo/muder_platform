import { useState } from 'react';
import { Badge } from '@/shared/components/ui';
import { ImageRoleSheetPanel } from '@/features/editor/components/design/ImageRoleSheetPanel';

const sampleImageUrls = [
  svgDataUrl('1', '사건 전날', '알리바이와 동기를 한 장씩 읽는 이미지 롤지입니다.'),
  svgDataUrl('2', '비밀', '플레이어가 반드시 확인해야 하는 비밀 정보를 담습니다.'),
  svgDataUrl('3', '관계도', '인물 관계와 의심 포인트를 이미지로 정리합니다.'),
];

export default function Phase24ImageRoleSheetPreviewPage() {
  const [imageUrls, setImageUrls] = useState(sampleImageUrls);
  const [imageDraft, setImageDraft] = useState('');
  const [page, setPage] = useState(1);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'failed'>('idle');

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 space-y-4">
          <header className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="warning">DEV ONLY</Badge>
              <Badge variant="default">Phase 24 PR-3E</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              이미지 롤지 Viewer Preview
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              실제 에디터 역할지 섹션에서 사용하는 이미지 viewer 컴포넌트를 그대로 렌더링합니다.
              모바일에서는 페이지 목록, 조작 버튼, 이미지가 세로로 읽히는지 확인합니다.
            </p>
          </header>

          <ImageRoleSheetPanel
            characterName="홍길동"
            imageUrls={imageUrls}
            imageDraft={imageDraft}
            page={page}
            saveStatus={saveStatus}
            isPending={false}
            onImageDraftChange={(url) => {
              setImageDraft(url);
              setSaveStatus('idle');
            }}
            onAddImagePage={() => {
              const nextUrl = imageDraft.trim();
              if (!nextUrl) return;
              setImageUrls((current) => {
                setPage(current.length + 1);
                return [...current, nextUrl];
              });
              setImageDraft('');
              setSaveStatus('idle');
            }}
            onRemoveImagePage={(index) => {
              setImageUrls((current) => {
                const next = current.filter((_, currentIndex) => currentIndex !== index);
                setPage((currentPage) => Math.max(1, Math.min(currentPage, next.length || 1)));
                return next;
              });
              setSaveStatus('idle');
            }}
            onMoveImagePage={(index, direction) => {
              setImageUrls((current) => {
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
            }}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(imageUrls.length, current + 1))}
            onSave={() => setSaveStatus('saved')}
          />
        </section>

        <aside className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 lg:sticky lg:top-5 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/80">확인 포인트</p>
          <ul className="space-y-2 text-xs leading-5 text-slate-400">
            <li>1. 페이지 번호가 현재 이미지와 함께 바뀌는지</li>
            <li>2. 모바일 폭에서 가로 스크롤 없이 세로로 읽히는지</li>
            <li>3. URL 추가/삭제/순서 변경 버튼이 터치하기 쉬운지</li>
            <li>4. 저장 상태 문장이 사용자가 이해하기 쉬운지</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}

function svgDataUrl(pageNumber: string, title: string, body: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="1040" viewBox="0 0 720 1040">
      <rect width="720" height="1040" fill="#0f172a"/>
      <rect x="48" y="48" width="624" height="944" rx="28" fill="#111827" stroke="#f59e0b" stroke-opacity="0.35" stroke-width="2"/>
      <text x="88" y="132" fill="#f59e0b" font-size="34" font-family="serif" font-weight="700">Role Sheet ${pageNumber}</text>
      <text x="88" y="214" fill="#e5e7eb" font-size="52" font-family="serif" font-weight="700">${title}</text>
      <text x="88" y="300" fill="#94a3b8" font-size="28" font-family="sans-serif">${body}</text>
      <text x="88" y="900" fill="#64748b" font-size="22" font-family="monospace">MMP Phase 24 PR-3E</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
