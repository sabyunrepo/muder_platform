import { Users, Clock, Play, Star, Coins } from 'lucide-react';
import { Card, Badge } from '@/shared/components/ui';
import type { ThemeSummary } from '../api';

interface ThemeCardProps {
  theme: ThemeSummary;
  onClick: (theme: ThemeSummary) => void;
}

/** 난이도별 Badge variant 매핑 */
const difficultyVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  easy: 'success',
  normal: 'warning',
  hard: 'danger',
};

/** 난이도 한국어 라벨 */
const difficultyLabel: Record<string, string> = {
  easy: '쉬움',
  normal: '보통',
  hard: '어려움',
};

/** gradient placeholder (썸네일 없을 때) */
const GRADIENT_PLACEHOLDER =
  'bg-[linear-gradient(135deg,var(--mmp-color-surface-soft),var(--mmp-color-hairline),color-mix(in_oklab,var(--mmp-color-primary)_22%,transparent))]';

export function ThemeCard({ theme, onClick }: ThemeCardProps) {
  return (
    <Card hoverable onClick={() => onClick(theme)} className="flex flex-col gap-3 p-0 overflow-hidden">
      {/* 썸네일 */}
      <div className="relative h-40 w-full">
        {theme.cover_image ? (
          <img
            src={theme.cover_image}
            alt={theme.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={`h-full w-full ${GRADIENT_PLACEHOLDER}`} />
        )}
        {/* 난이도 Badge (이미지 위 우상단) */}
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          {theme.coin_price > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-[color-mix(in_oklab,var(--mmp-color-primary)_12%,transparent)] px-2 py-0.5 text-sm text-[var(--mmp-color-primary)]">
              <Coins className="h-3.5 w-3.5" />
              {theme.coin_price.toLocaleString()}
            </span>
          )}
          {theme.difficulty && (
            <Badge variant={difficultyVariant[theme.difficulty] ?? 'default'}>
              {difficultyLabel[theme.difficulty] ?? theme.difficulty}
            </Badge>
          )}
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
        <h3 className="truncate text-base font-semibold text-[var(--mmp-color-ink)]">
          {theme.title}
        </h3>
        <p className="line-clamp-2 text-sm text-[var(--mmp-color-steel)]">{theme.description}</p>

        {/* 메타 정보 */}
        <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-[var(--mmp-color-steel)]">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {theme.min_players}-{theme.max_players}명
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {theme.duration_min}분
          </span>
          {theme.play_count !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Play className="h-3.5 w-3.5" />
              {theme.play_count.toLocaleString()}회
            </span>
          )}
          {theme.rating !== undefined && (
            <span className="inline-flex items-center gap-1 text-[var(--mmp-color-warning)]">
              <Star className="h-3.5 w-3.5 fill-[var(--mmp-color-warning)]" />
              {theme.rating.toFixed(1)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Coins className="h-3.5 w-3.5" />
            {theme.coin_price > 0
              ? `${theme.coin_price.toLocaleString()} 코인`
              : '무료'}
          </span>
        </div>
      </div>
    </Card>
  );
}
