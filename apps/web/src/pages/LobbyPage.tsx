import { useState, useCallback } from 'react';
import { Plus, Hash } from 'lucide-react';
import { Button, Spinner, Pagination } from '@/shared/components/ui';
import { useThemes } from '@/features/lobby/api';
import type { ThemeSummary } from '@/features/lobby/api';
import {
  ThemeCard,
  ThemeFilter,
  RoomList,
  CreateRoomModal,
  JoinByCodeModal,
} from '@/features/lobby/components';
import type { ThemeFilterValues } from '@/features/lobby/components';

const THEMES_PER_PAGE = 12;

export default function LobbyPage() {
  // 페이지네이션
  const [page, setPage] = useState(1);

  // 필터
  const [filters, setFilters] = useState<ThemeFilterValues>({
    search: '',
    difficulty: '',
    playerCount: '',
    sort: 'latest',
  });

  // 모달
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeSummary | null>(null);

  // 테마 목록 (서버에서 전체를 가져와 클라이언트 필터링)
  const {
    data: allThemes,
    isLoading,
    isError,
    refetch,
  } = useThemes({ limit: 200 });

  // 클라이언트 필터링
  const filteredThemes = filterThemes(allThemes ?? [], filters);
  const totalPages = Math.max(1, Math.ceil(filteredThemes.length / THEMES_PER_PAGE));
  const pagedThemes = filteredThemes.slice(
    (page - 1) * THEMES_PER_PAGE,
    page * THEMES_PER_PAGE,
  );

  // 필터 변경 시 첫 페이지로 리셋
  const handleFilterChange = useCallback((newFilters: ThemeFilterValues) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  // 테마 카드 클릭 → 방 생성 모달
  const handleThemeClick = useCallback((theme: ThemeSummary) => {
    setSelectedTheme(theme);
    setIsCreateOpen(true);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-100">로비</h1>
        <div className="flex gap-3">
          <Button
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setSelectedTheme(null);
              setIsCreateOpen(true);
            }}
          >
            방 만들기
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Hash className="h-4 w-4" />}
            onClick={() => setIsJoinOpen(true)}
          >
            코드로 참가
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <section className="mt-6">
        <ThemeFilter values={filters} onChange={handleFilterChange} />
      </section>

      {/* 테마 그리드 */}
      <section className="mt-6">
        {isLoading && (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-sm text-red-400">
              테마 목록을 불러오지 못했습니다.
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              재시도
            </Button>
          </div>
        )}

        {!isLoading && !isError && (
          <>
            {pagedThemes.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                조건에 맞는 테마가 없습니다.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pagedThemes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    onClick={handleThemeClick}
                  />
                ))}
              </div>
            )}

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </section>

      {/* 구분선 */}
      <hr className="my-8 border-slate-800" />

      {/* 공개 방 섹션 */}
      <section>
        <h2 className="mb-4 text-xl font-semibold text-slate-100">공개 방</h2>
        <RoomList />
      </section>

      {/* 모달 */}
      <CreateRoomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        selectedTheme={selectedTheme}
      />
      <JoinByCodeModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 클라이언트 필터 유틸
// ---------------------------------------------------------------------------

/** 인원수 범위 파싱 */
function parsePlayerRange(value: string): [number, number] | null {
  if (!value) return null;
  if (value === '8+') return [8, Infinity];
  const parts = value.split('-').map(Number);
  if (parts.length === 2) return [parts[0], parts[1]];
  return null;
}

function filterThemes(
  themes: ThemeSummary[],
  filters: ThemeFilterValues,
): ThemeSummary[] {
  let result = themes;

  // 검색어
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }

  // 난이도
  if (filters.difficulty) {
    result = result.filter((t) => t.difficulty === filters.difficulty);
  }

  // 인원수
  const range = parsePlayerRange(filters.playerCount);
  if (range) {
    const [min, max] = range;
    result = result.filter(
      (t) => t.player_count_max >= min && t.player_count_min <= max,
    );
  }

  // 정렬
  result = [...result];
  switch (filters.sort) {
    case 'popular':
      result.sort((a, b) => b.play_count - a.play_count);
      break;
    case 'rating':
      result.sort((a, b) => b.rating - a.rating);
      break;
    case 'latest':
    default:
      // 서버 기본 순서 유지 (최신순)
      break;
  }

  return result;
}
