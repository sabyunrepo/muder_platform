import { useState, useCallback } from 'react';
import { Plus, Hash } from 'lucide-react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Button,
  LoadingState,
  PageShell,
  Pagination,
  SectionHeader,
} from '@/shared/components/ui';
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
import { useAuthStore } from '@/stores/authStore';

const THEMES_PER_PAGE = 12;

export default function LobbyPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

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
  const requireAuthenticatedAction = useCallback(() => {
    if (isAuthLoading) return false;
    if (!isAuthenticated) {
      navigate('/login');
      return false;
    }
    return true;
  }, [isAuthLoading, isAuthenticated, navigate]);

  const handleOpenCreateRoom = useCallback(
    (theme: ThemeSummary | null = null) => {
      if (!requireAuthenticatedAction()) return;
      setSelectedTheme(theme);
      setIsCreateOpen(true);
    },
    [requireAuthenticatedAction],
  );

  const handleOpenJoinByCode = useCallback(() => {
    if (!requireAuthenticatedAction()) return;
    setIsJoinOpen(true);
  }, [requireAuthenticatedAction]);

  const handleThemeClick = useCallback(
    (theme: ThemeSummary) => {
      handleOpenCreateRoom(theme);
    },
    [handleOpenCreateRoom],
  );

  return (
    <PageShell
      header={
        <SectionHeader
          title="로비"
          description="플레이할 테마를 고르고 공개 방에 참가하세요."
          action={
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                leftIcon={<Plus className="h-4 w-4" />}
                disabled={isAuthLoading}
                onClick={() => handleOpenCreateRoom()}
              >
                방 만들기
              </Button>
              <Button
                variant="secondary"
                leftIcon={<Hash className="h-4 w-4" />}
                disabled={isAuthLoading}
                onClick={handleOpenJoinByCode}
              >
                코드로 참가
              </Button>
            </div>
          }
        />
      }
    >
      <section>
        <ThemeFilter values={filters} onChange={handleFilterChange} />
      </section>

      <section>
        {isLoading && <LoadingState label="테마 목록을 불러오는 중" />}

        {isError && (
          <Alert tone="error" title="테마 목록을 불러오지 못했습니다">
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                재시도
              </Button>
            </div>
          </Alert>
        )}

        {!isLoading && !isError && (
          <>
            {pagedThemes.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--mmp-color-steel)]">
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

      <section className="border-t border-[var(--mmp-color-hairline)] pt-6">
        <SectionHeader title="공개 방" description="대기 중인 방에 바로 참가할 수 있습니다." />
        <RoomList />
      </section>

      <CreateRoomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        selectedTheme={selectedTheme}
      />
      <JoinByCodeModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
      />
    </PageShell>
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

  // 난이도 (서버 미지원 — 값 있는 테마만 통과)
  if (filters.difficulty) {
    result = result.filter((t) => t.difficulty === filters.difficulty);
  }

  // 인원수
  const range = parsePlayerRange(filters.playerCount);
  if (range) {
    const [min, max] = range;
    result = result.filter(
      (t) => t.max_players >= min && t.min_players <= max,
    );
  }

  // 정렬
  result = [...result];
  switch (filters.sort) {
    case 'popular':
      result.sort((a, b) => (b.play_count ?? 0) - (a.play_count ?? 0));
      break;
    case 'rating':
      result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case 'latest':
    default:
      // 서버 기본 순서 유지 (최신순)
      break;
  }

  return result;
}
