import { useRef, useCallback, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input, Select } from '@/shared/components/ui';

export interface ThemeFilterValues {
  search: string;
  difficulty: string;
  playerCount: string;
  sort: string;
}

interface ThemeFilterProps {
  values: ThemeFilterValues;
  onChange: (values: ThemeFilterValues) => void;
}

const difficultyOptions = [
  { value: '', label: '전체 난이도' },
  { value: 'easy', label: '쉬움' },
  { value: 'normal', label: '보통' },
  { value: 'hard', label: '어려움' },
];

const playerCountOptions = [
  { value: '', label: '전체 인원' },
  { value: '2-4', label: '2-4명' },
  { value: '4-6', label: '4-6명' },
  { value: '6-8', label: '6-8명' },
  { value: '8+', label: '8명 이상' },
];

const sortOptions = [
  { value: 'latest', label: '최신순' },
  { value: 'popular', label: '인기순' },
  { value: 'rating', label: '평점순' },
];

export function ThemeFilter({ values, onChange }: ThemeFilterProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const [localSearch, setLocalSearch] = useState(values.search);

  // H3: cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /** 검색어 debounce (300ms) — H4: valuesRef로 stale closure 방지 */
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newSearch = e.target.value;
      setLocalSearch(newSearch);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onChange({ ...valuesRef.current, search: newSearch });
      }, 300);
    },
    [onChange],
  );

  const handleSelectChange = useCallback(
    (key: keyof Omit<ThemeFilterValues, 'search'>) =>
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange({ ...valuesRef.current, [key]: e.target.value });
      },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input
          placeholder="테마 검색..."
          value={localSearch}
          onChange={handleSearchChange}
          leftIcon={<Search className="h-4 w-4" />}
        />
      </div>
      <Select
        options={difficultyOptions}
        value={values.difficulty}
        onChange={handleSelectChange('difficulty')}
      />
      <Select
        options={playerCountOptions}
        value={values.playerCount}
        onChange={handleSelectChange('playerCount')}
      />
      <Select
        options={sortOptions}
        value={values.sort}
        onChange={handleSelectChange('sort')}
      />
    </div>
  );
}
