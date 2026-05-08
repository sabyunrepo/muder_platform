import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ClueResponse } from '@/features/editor/api';
import { readClueItemEffect, type EditorConfig } from '@/features/editor/utils/configShape';
import { ClueRuntimeEffectCard } from './ClueRuntimeEffectCard';

function clue(overrides: Partial<ClueResponse>): ClueResponse {
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
    use_effect: 'reveal',
    use_target: 'self',
    use_consumed: false,
    ...overrides,
  };
}

const clues = [
  clue({ id: 'clue-1', name: '피 묻은 열쇠' }),
  clue({ id: 'clue-2', name: '금고 비밀번호' }),
  clue({ id: 'clue-3', name: '찢어진 사진' }),
];

afterEach(cleanup);

describe('ClueRuntimeEffectCard', () => {
  it('기존 정보 공개 효과를 제작자 언어로 편집하고 저장한다', () => {
    const onConfigChange = vi.fn();
    const configJson: EditorConfig = {
      modules: {
        clue_interaction: {
          enabled: true,
          config: {
            itemEffects: {
              'clue-1': {
                effect: 'reveal',
                target: 'self',
                trigger: 'on_view',
                condition: { kind: 'password', value: '0427' },
                revealText: '숫자 0427이 보입니다.',
                consume: false,
              },
            },
          },
        },
      },
    };

    render(
      <ClueRuntimeEffectCard
        clue={clues[0]}
        clues={clues}
        configJson={configJson}
        onConfigChange={onConfigChange}
      />,
    );

    expect(screen.getByText('단서 공개 조건')).toBeDefined();
    expect(screen.queryByRole('button', { name: '즉시 공개' })).toBeNull();
    expect(screen.getByLabelText(/암호 입력 후 공개/)).toHaveProperty('value', '0427');
    expect(screen.queryByText('itemEffects')).toBeNull();
    expect(screen.queryByText('grant_clue')).toBeNull();

    fireEvent.change(screen.getByLabelText('공개할 정보'), {
      target: { value: '열쇠 뒤에 새 숫자 1234가 보입니다.' },
    });
    fireEvent.click(screen.getByLabelText(/사용하면 내 단서함에서 사라짐/));
    fireEvent.click(screen.getByRole('button', { name: '공개 조건 저장' }));

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    const saved = onConfigChange.mock.calls[0][0] as EditorConfig;
    expect(readClueItemEffect(saved, 'clue-1')).toMatchObject({
      effect: 'reveal',
      target: 'self',
      condition: { kind: 'password', value: '0427' },
      revealText: '열쇠 뒤에 새 숫자 1234가 보입니다.',
      consume: true,
    });
  });

  it('검색으로 지급할 단서를 다중 선택하고 저장한다', () => {
    const onConfigChange = vi.fn();

    render(
      <ClueRuntimeEffectCard
        clue={clues[0]}
        clues={clues}
        configJson={{}}
        onConfigChange={onConfigChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '새 단서 지급' }));
    fireEvent.change(screen.getByLabelText('지급할 단서 검색'), {
      target: { value: '금고' },
    });
    fireEvent.click(screen.getByRole('button', { name: '금고 비밀번호' }));
    fireEvent.change(screen.getByLabelText(/암호 입력 후 공개/), { target: { value: 'gold' } });

    expect(screen.getByText('선택된 지급 단서')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '공개 조건 저장' }));

    expect(onConfigChange).toHaveBeenCalledTimes(1);
    const saved = onConfigChange.mock.calls[0][0] as EditorConfig;
    expect(readClueItemEffect(saved, 'clue-1')).toMatchObject({
      effect: 'grant_clue',
      target: 'self',
      condition: { kind: 'password', value: 'gold' },
      grantClueIds: ['clue-2'],
    });
  });

  it('설명 변경 효과를 입력하고 저장한다', () => {
    const onConfigChange = vi.fn();

    render(
      <ClueRuntimeEffectCard
        clue={clues[0]}
        clues={clues}
        configJson={{
          modules: {
            clue_interaction: {
              enabled: true,
              config: {
            itemEffects: {
                  'clue-1': {
                    effect: 'description_change',
                    target: 'self',
                    condition: { kind: 'password', value: 'open' },
                    descriptionText: '사용 후 새 설명',
                    consume: false,
                  },
                },
              },
            },
          },
        }}
        onConfigChange={onConfigChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('사용 후 바뀔 설명'), {
      target: { value: '사용 후 다른 문장이 보입니다.' },
    });
    fireEvent.click(screen.getByRole('button', { name: '공개 조건 저장' }));

    const saved = onConfigChange.mock.calls[0][0] as EditorConfig;
    expect(readClueItemEffect(saved, 'clue-1')).toMatchObject({
      effect: 'description_change',
      target: 'self',
      condition: { kind: 'password', value: 'open' },
      descriptionText: '사용 후 다른 문장이 보입니다.',
    });
  });

  it('암호가 비어 있으면 저장을 막고 훔쳐보기/가져오기 효과를 저장한다', () => {
    const onConfigChange = vi.fn();

    render(
      <ClueRuntimeEffectCard
        clue={clues[0]}
        clues={clues}
        configJson={{}}
        onConfigChange={onConfigChange}
      />,
    );

    expect(screen.getByRole('button', { name: '공개 조건 저장' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText(/암호 입력 후 공개/), { target: { value: 'peek' } });
    fireEvent.click(screen.getByRole('button', { name: '단서 가져오기' }));
    fireEvent.click(screen.getByRole('button', { name: '공개 조건 저장' }));

    const saved = onConfigChange.mock.calls[0][0] as EditorConfig;
    expect(readClueItemEffect(saved, 'clue-1')).toMatchObject({
      effect: 'steal',
      target: 'player',
      condition: { kind: 'password', value: 'peek' },
    });
  });

  it('살해 요청 효과를 위험 모드로 표시하고 저장한다', () => {
    const onConfigChange = vi.fn();

    render(
      <ClueRuntimeEffectCard
        clue={clues[0]}
        clues={clues}
        configJson={{}}
        onConfigChange={onConfigChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/암호 입력 후 공개/), { target: { value: 'knife' } });
    fireEvent.click(screen.getByRole('button', { name: '살해 요청' }));

    expect(screen.getByText(/생존 상태를 런타임에서 사망으로 변경/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '공개 조건 저장' }));

    const saved = onConfigChange.mock.calls[0][0] as EditorConfig;
    expect(readClueItemEffect(saved, 'clue-1')).toMatchObject({
      effect: 'kill',
      target: 'player',
      condition: { kind: 'password', value: 'knife' },
    });
  });
});
