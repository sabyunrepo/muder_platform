import { useState, useEffect, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import {
  useUpdateTheme,
  type EditorThemeResponse,
  type UpdateThemeRequest,
} from '@/features/editor/api';

interface OverviewTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

export function OverviewTab({ themeId, theme }: OverviewTabProps) {
  const [title, setTitle] = useState(theme.title);
  const [description, setDescription] = useState(theme.description ?? '');
  const [coverImage, setCoverImage] = useState(theme.cover_image ?? '');
  const [minPlayers, setMinPlayers] = useState(theme.min_players);
  const [maxPlayers, setMaxPlayers] = useState(theme.max_players);
  const [durationMin, setDurationMin] = useState(theme.duration_min);
  const [price, setPrice] = useState(theme.price);
  const [coinPrice, setCoinPrice] = useState(theme.coin_price);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateTheme = useUpdateTheme(themeId);

  // Sync form state when server data changes (e.g. after save)
  useEffect(() => {
    setTitle(theme.title);
    setDescription(theme.description ?? '');
    setCoverImage(theme.cover_image ?? '');
    setMinPlayers(theme.min_players);
    setMaxPlayers(theme.max_players);
    setDurationMin(theme.duration_min);
    setPrice(theme.price);
    setCoinPrice(theme.coin_price);
    setErrors({});
  }, [theme.version]);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      next.title = '제목은 필수입니다';
    } else if (trimmedTitle.length > 100) {
      next.title = '제목은 100자 이하여야 합니다';
    }

    if (description.length > 2000) {
      next.description = '설명은 2000자 이하여야 합니다';
    }

    if (minPlayers < 2 || minPlayers > 20) {
      next.minPlayers = '최소 인원은 2~20 사이여야 합니다';
    }

    if (maxPlayers < 2 || maxPlayers > 20) {
      next.maxPlayers = '최대 인원은 2~20 사이여야 합니다';
    } else if (maxPlayers < minPlayers) {
      next.maxPlayers = '최대 인원은 최소 인원 이상이어야 합니다';
    }

    if (durationMin < 10 || durationMin > 300) {
      next.durationMin = '진행 시간은 10~300분 사이여야 합니다';
    }

    if (price < 0) {
      next.price = '가격은 0 이상이어야 합니다';
    }

    if (coinPrice < 0 || coinPrice > 100000) {
      next.coinPrice = '코인 가격은 0~100,000 사이여야 합니다';
    }

    return next;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const body: UpdateThemeRequest = {
      title: title.trim(),
      description: description || undefined,
      cover_image: coverImage || undefined,
      min_players: minPlayers,
      max_players: maxPlayers,
      duration_min: durationMin,
      price,
      coin_price: coinPrice,
    };

    updateTheme.mutate(body, {
      onSuccess: () => {
        toast.success('테마가 수정되었습니다');
      },
      onError: (err) => {
        toast.error(err.message || '테마 수정에 실패했습니다');
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="테마 제목"
        required
        maxLength={100}
        error={errors.title}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="overview-description" className="text-sm font-medium text-slate-300">
          설명
        </label>
        <textarea
          id="overview-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="테마에 대한 설명을 입력하세요"
          maxLength={2000}
          rows={4}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        {errors.description && (
          <p className="text-sm text-red-400">{errors.description}</p>
        )}
      </div>

      <Input
        label="커버 이미지 URL"
        type="url"
        value={coverImage}
        onChange={(e) => setCoverImage(e.target.value)}
        placeholder="https://example.com/image.jpg"
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="최소 인원"
          type="number"
          value={minPlayers}
          onChange={(e) => setMinPlayers(Number(e.target.value))}
          min={2}
          max={20}
          error={errors.minPlayers}
        />
        <Input
          label="최대 인원"
          type="number"
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          min={2}
          max={20}
          error={errors.maxPlayers}
        />
      </div>

      <Input
        label="진행 시간 (분)"
        type="number"
        value={durationMin}
        onChange={(e) => setDurationMin(Number(e.target.value))}
        min={10}
        max={300}
        error={errors.durationMin}
      />

      <Input
        label="가격"
        type="number"
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        min={0}
        error={errors.price}
      />

      <Input
        label="코인 가격"
        type="number"
        value={coinPrice}
        onChange={(e) => setCoinPrice(Number(e.target.value))}
        min={0}
        max={100000}
        placeholder="0 (무료)"
        error={errors.coinPrice}
      />

      <Button type="submit" isLoading={updateTheme.isPending}>
        저장
      </Button>
    </form>
  );
}
