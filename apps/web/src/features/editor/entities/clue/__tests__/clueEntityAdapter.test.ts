import { describe, expect, it } from 'vitest';
import type { ClueResponse } from '@/features/editor/api/types';
import {
  buildClueBadges,
  buildClueUsePayload,
  formatClueConsumeLabel,
  getClueUseEffectOption,
  toClueEditorViewModel,
} from '../clueEntityAdapter';

function clue(overrides: Partial<ClueResponse> = {}): ClueResponse {
  return {
    id: 'clue-1',
    theme_id: 'theme-1',
    location_id: null,
    name: '피 묻은 열쇠',
    description: '잠긴 상자를 열 수 있다.',
    image_url: null,
    is_common: false,
    level: 1,
    sort_order: 0,
    created_at: '2026-05-03T00:00:00Z',
    is_usable: true,
    use_effect: 'peek',
    use_target: 'player',
    use_consumed: true,
    reveal_round: null,
    hide_round: null,
    ...overrides,
  };
}

describe('clueEntityAdapter', () => {
  it('단서 API 응답을 제작자용 ViewModel으로 변환한다', () => {
    const vm = toClueEditorViewModel(clue({ use_effect: 'steal', reveal_round: 2, hide_round: 4 }), 3);

    expect(vm).toMatchObject({
      id: 'clue-1',
      name: '피 묻은 열쇠',
      description: '잠긴 상자를 열 수 있다.',
      publicScopeLabel: '지정된 캐릭터나 장소에서만 획득',
      roundLabel: 'R2~4',
      useEffectLabel: '다른 플레이어에게서 단서 가져오기',
      consumeLabel: '사용하면 내 단서함에서 사라짐',
      badges: ['사용 가능', '연결 3'],
    });
  });

  it('사용 효과가 없는 단서는 내부 key 없이 사용자 문구로 표시한다', () => {
    const vm = toClueEditorViewModel(clue({ is_usable: false, use_effect: null, use_consumed: false }));

    expect(vm.useEffectLabel).toBe('사용 효과 없음');
    expect(vm.useEffectDescription).toBe('플레이어가 이 단서를 눌러 실행하는 효과가 없습니다.');
    expect(vm.consumeLabel).toBe('해당 없음');
  });

  it('consume은 독립 효과가 아니라 사용 후 처리 옵션으로 표시한다', () => {
    expect(formatClueConsumeLabel({ is_usable: true, use_consumed: true })).toBe('사용하면 내 단서함에서 사라짐');
    expect(formatClueConsumeLabel({ is_usable: true, use_consumed: false })).toBe('사용 후에도 단서함에 남음');
  });

  it('효과별 권장 대상 선택 방식을 제공한다', () => {
    expect(getClueUseEffectOption('peek')).toMatchObject({ target: 'player', requiresTargetSelection: true });
    expect(getClueUseEffectOption('reveal')).toMatchObject({ target: 'self', requiresTargetSelection: false });
    expect(getClueUseEffectOption('unknown')).toBeNull();
  });

  it('사용 불가 단서 저장 payload에서는 효과 필드를 비운다', () => {
    expect(buildClueUsePayload({ name: '단서', is_usable: false, use_effect: 'peek', use_target: 'player', use_consumed: true })).toMatchObject({
      is_usable: false,
      use_effect: undefined,
      use_target: undefined,
      use_consumed: false,
    });
  });

  it('사용 가능 payload에서는 효과에 맞는 대상 선택 방식을 적용한다', () => {
    expect(buildClueUsePayload({ name: '단서', is_usable: true, use_effect: 'reveal', use_target: 'player', use_consumed: false })).toMatchObject({
      is_usable: true,
      use_effect: 'reveal',
      use_target: 'self',
      use_consumed: false,
    });
  });

  it('목록 배지는 공개/사용/연결 상태만 제작자 언어로 표시한다', () => {
    expect(buildClueBadges(clue({ is_common: true }), 0)).toEqual(['모두에게 공개', '사용 가능', '미배치']);
  });
});
