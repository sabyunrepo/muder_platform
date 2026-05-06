import type { ClueResponse, CreateClueRequest, UpdateClueRequest } from '@/features/editor/api/types';
import { formatRoundRange } from '@/features/editor/utils/roundFormat';

export type ClueUseEffect = 'peek' | 'steal' | 'reveal' | 'block' | 'swap';
export type ClueUseTarget = 'player' | 'clue' | 'self';

export interface ClueUseEffectOption {
  value: ClueUseEffect;
  target: ClueUseTarget;
  label: string;
  description: string;
  requiresTargetSelection: boolean;
}

export interface ClueEditorViewModel {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  imageMediaId: string | null;
  publicScopeLabel: string;
  roundLabel: string;
  useEffectLabel: string;
  useEffectDescription: string;
  consumeLabel: string;
  badges: string[];
}

export const clueUseEffectOptions: ClueUseEffectOption[] = [
  {
    value: 'peek',
    target: 'player',
    label: '다른 플레이어 단서 보기',
    description: '사용자가 선택한 플레이어의 보유 단서 목록을 확인합니다.',
    requiresTargetSelection: true,
  },
  {
    value: 'steal',
    target: 'player',
    label: '다른 플레이어에게서 단서 가져오기',
    description: '대상 플레이어의 단서 하나를 가져오는 효과입니다. 실제 양도 기능은 후속 엔진에서 분리합니다.',
    requiresTargetSelection: true,
  },
  {
    value: 'reveal',
    target: 'self',
    label: '정보 공개하기',
    description: '사용한 플레이어에게 추가 정보를 공개합니다.',
    requiresTargetSelection: false,
  },
  {
    value: 'block',
    target: 'player',
    label: '상대의 사용 막기',
    description: '대상 플레이어의 다음 단서 사용을 막는 효과입니다.',
    requiresTargetSelection: true,
  },
  {
    value: 'swap',
    target: 'clue',
    label: '단서 교환하기',
    description: '선택한 단서와 교환하는 효과입니다.',
    requiresTargetSelection: true,
  },
];

const effectMap = new Map<string, ClueUseEffectOption>(
  clueUseEffectOptions.map((option) => [option.value, option]),
);

export function getClueUseEffectOption(effect?: string | null): ClueUseEffectOption | null {
  if (!effect) return null;
  return effectMap.get(effect) ?? null;
}

export function toClueEditorViewModel(clue: ClueResponse, referenceCount = 0): ClueEditorViewModel {
  const effect = clue.is_usable ? getClueUseEffectOption(clue.use_effect) : null;
  return {
    id: clue.id,
    name: clue.name,
    description: clue.description?.trim() || '플레이어에게 보일 단서 설명을 입력하세요.',
    imageUrl: clue.image_url ?? null,
    imageMediaId: clue.image_media_id ?? null,
    publicScopeLabel: clue.is_common ? '모든 플레이어가 공유' : '지정된 캐릭터나 장소에서만 획득',
    roundLabel: formatRoundRange(clue.reveal_round, clue.hide_round) || '처음부터 끝까지',
    useEffectLabel: effect?.label ?? '사용 효과 없음',
    useEffectDescription: effect?.description ?? '플레이어가 이 단서를 눌러 실행하는 효과가 없습니다.',
    consumeLabel: formatClueConsumeLabel(clue),
    badges: buildClueBadges(clue, referenceCount),
  };
}

export function buildClueBadges(clue: ClueResponse, referenceCount: number): string[] {
  return [
    clue.is_common ? '모두에게 공개' : null,
    clue.is_usable ? '사용 가능' : null,
    referenceCount > 0 ? `연결 ${referenceCount}` : '미배치',
  ].filter((badge): badge is string => Boolean(badge));
}

export function formatClueConsumeLabel(clue: Pick<ClueResponse, 'is_usable' | 'use_consumed'>): string {
  if (!clue.is_usable) return '해당 없음';
  return clue.use_consumed ? '사용하면 내 단서함에서 사라짐' : '사용 후에도 단서함에 남음';
}

export function buildClueUsePayload<T extends CreateClueRequest | UpdateClueRequest>(payload: T): T {
  if (payload.is_usable === false) {
    return {
      ...payload,
      use_effect: undefined,
      use_target: undefined,
      use_consumed: false,
    };
  }

  if (payload.is_usable !== true) {
    return payload;
  }

  const hasEffect = Boolean(payload.use_effect && payload.use_effect.trim());
  const option = getClueUseEffectOption(payload.use_effect);

  if (hasEffect && !option) {
    return {
      ...payload,
      use_consumed: Boolean(payload.use_consumed),
    };
  }

  return {
    ...payload,
    use_effect: option?.value ?? 'peek',
    use_target: option?.target ?? 'player',
    use_consumed: Boolean(payload.use_consumed),
  };
}
