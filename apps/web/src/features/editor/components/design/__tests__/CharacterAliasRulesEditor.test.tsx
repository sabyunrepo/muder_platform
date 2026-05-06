import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CharacterAliasRulesEditor } from '../CharacterAliasRulesEditor';
import type { CharacterAliasRule } from '@/features/editor/api';

vi.mock('@/features/editor/components/media/MediaPicker', () => ({
  MediaPicker: ({
    open,
    selectedId,
    onSelect,
  }: {
    open: boolean;
    selectedId?: string | null;
    onSelect: (media: { id: string; name: string; type: string }) => void;
  }) =>
    open ? (
      <div>
        <span>selected:{selectedId ?? 'none'}</span>
        <button type="button" onClick={() => onSelect({ id: 'media-image-1', name: '별칭 아이콘', type: 'IMAGE' })}>
          별칭 아이콘 선택
        </button>
      </div>
    ) : null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const characterOptions = [{ id: 'char-1', name: '홍길동' }];

function renderEditor(overrides: Partial<{
  rules: CharacterAliasRule[];
  disabled: boolean;
  onChange: (rules: CharacterAliasRule[]) => void;
  onSave: (rules: CharacterAliasRule[]) => void;
}> = {}) {
  const onChange = overrides.onChange ?? vi.fn();
  const onSave = overrides.onSave ?? vi.fn();
  render(
    <CharacterAliasRulesEditor
      themeId="theme-1"
      characterName="홍길동"
      characterImageUrl="https://cdn.example/base.webp"
      rules={overrides.rules ?? []}
      characterOptions={characterOptions}
      disabled={overrides.disabled ?? false}
      onChange={onChange}
      onSave={onSave}
    />,
  );
  return { onChange, onSave };
}

function renderStatefulEditor(initialRules: CharacterAliasRule[], onSave = vi.fn()) {
  function Harness() {
    const [rules, setRules] = useState(initialRules);
    return (
      <CharacterAliasRulesEditor
        themeId="theme-1"
        characterName="홍길동"
        characterImageUrl="https://cdn.example/base.webp"
        rules={rules}
        characterOptions={characterOptions}
        disabled={false}
        onChange={setRules}
        onSave={onSave}
      />
    );
  }
  render(<Harness />);
  return { onSave };
}

describe('CharacterAliasRulesEditor', () => {
  it('빈 상태에서 규칙을 추가하면 바로 완성 가능한 기본 조건을 만든다', () => {
    const { onChange } = renderEditor();

    const [topLevelAddButton] = screen.getAllByRole('button', { name: '규칙 추가' });
    fireEvent.click(topLevelAddButton);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        label: '',
        display_name: '',
        display_icon_url: '',
        priority: 0,
        condition: expect.objectContaining({
          operator: 'AND',
          rules: [expect.objectContaining({
            variable: 'custom_flag',
            target_flag_key: 'alias_ready',
            comparator: '=',
            value: 'true',
          })],
        }),
      }),
    ]);
  });

  it('새 규칙 우선순위는 기존 최대값 다음 번호로 만든다', () => {
    const { onChange } = renderEditor({
      rules: [
        {
          id: 'alias-1',
          display_name: '목격자',
          priority: 7,
          condition: { id: 'group-1', operator: 'AND', rules: [{ id: 'rule-1', variable: 'custom_flag', target_flag_key: 'alias_ready', comparator: '=', value: 'true' }] },
        },
        {
          id: 'alias-2',
          display_name: '잠입자',
          priority: 2,
          condition: { id: 'group-2', operator: 'AND', rules: [{ id: 'rule-2', variable: 'custom_flag', target_flag_key: 'alias_ready', comparator: '=', value: 'true' }] },
        },
      ],
    });

    const [topLevelAddButton] = screen.getAllByRole('button', { name: '규칙 추가' });
    fireEvent.click(topLevelAddButton);

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'alias-1', priority: 7 }),
      expect.objectContaining({ id: 'alias-2', priority: 2 }),
      expect.objectContaining({ priority: 8 }),
    ]);
  });

  it('표시 이름, 아이콘, 우선순위를 수정해 저장한다', () => {
    const onSave = vi.fn();
    const rules: CharacterAliasRule[] = [{
      id: 'alias-1',
      label: '정체 공개',
      display_name: '목격자',
      display_icon_url: '',
      priority: 1,
      condition: {
        id: 'group-1',
        operator: 'AND',
        rules: [{
          id: 'rule-1',
          variable: 'custom_flag',
          target_flag_key: 'alias_ready',
          comparator: '=',
          value: 'true',
        }],
      },
    }];

    renderStatefulEditor(rules, onSave);
    fireEvent.change(screen.getByLabelText('표시 이름'), { target: { value: '밤의 목격자' } });
    fireEvent.change(screen.getByLabelText('표시 아이콘 URL'), { target: { value: 'https://cdn.example/night.webp' } });
    fireEvent.change(screen.getByLabelText('우선순위'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '플레이 중 표시 저장' }));

    expect(onSave).toHaveBeenCalledWith([expect.objectContaining({
      id: 'alias-1',
      display_name: '밤의 목격자',
      display_icon_url: 'https://cdn.example/night.webp',
      priority: 3,
    })]);
  });

  it('미디어 아이콘을 선택하면 URL 아이콘을 비우고 media id로 저장한다', () => {
    const onSave = vi.fn();
    const rules: CharacterAliasRule[] = [{
      id: 'alias-1',
      label: '정체 공개',
      display_name: '',
      display_icon_url: 'https://cdn.example/legacy.webp',
      priority: 1,
      condition: {
        id: 'group-1',
        operator: 'AND',
        rules: [{
          id: 'rule-1',
          variable: 'custom_flag',
          target_flag_key: 'alias_ready',
          comparator: '=',
          value: 'true',
        }],
      },
    }];

    renderStatefulEditor(rules, onSave);
    fireEvent.click(screen.getByRole('button', { name: '미디어에서 아이콘 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '별칭 아이콘 선택' }));
    expect(screen.getByText('미디어 이미지 선택됨')).toBeTruthy();
    expect((screen.getByLabelText('표시 아이콘 URL') as HTMLInputElement).value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: '플레이 중 표시 저장' }));

    expect(onSave).toHaveBeenCalledWith([expect.objectContaining({
      id: 'alias-1',
      display_icon_media_id: 'media-image-1',
      display_icon_url: undefined,
    })]);
  });

  it('우선순위 입력은 음수와 소수를 즉시 0 이상의 정수로 정리한다', () => {
    const onSave = vi.fn();
    const rules: CharacterAliasRule[] = [{
      id: 'alias-1',
      display_name: '목격자',
      priority: 1,
      condition: {
        id: 'group-1',
        operator: 'AND',
        rules: [{ id: 'rule-1', variable: 'custom_flag', target_flag_key: 'alias_ready', comparator: '=', value: 'true' }],
      },
    }];

    renderStatefulEditor(rules, onSave);

    fireEvent.change(screen.getByLabelText('우선순위'), { target: { value: '-3.8' } });
    expect((screen.getByLabelText('우선순위') as HTMLInputElement).value).toBe('0');

    fireEvent.change(screen.getByLabelText('우선순위'), { target: { value: '4.9' } });
    expect((screen.getByLabelText('우선순위') as HTMLInputElement).value).toBe('4');
  });

  it('규칙 삭제와 disabled 상태를 처리한다', () => {
    const onChange = vi.fn();
    const rule: CharacterAliasRule = {
      id: 'alias-1',
      display_name: '목격자',
      priority: 1,
      condition: { id: 'group-1', operator: 'AND', rules: [{ id: 'rule-1', variable: 'custom_flag', target_flag_key: 'alias_ready', comparator: '=', value: 'true' }] },
    };

    renderEditor({ rules: [rule], onChange, disabled: true });
    const [topLevelAddButton] = screen.getAllByRole('button', { name: '규칙 추가' });
    expect((topLevelAddButton as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '플레이 중 표시 저장' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '삭제' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('표시 이름') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('표시 아이콘 URL') as HTMLInputElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('미완성 규칙은 조용히 삭제하지 않고 저장을 막는다', () => {
    const onSave = vi.fn();
    const rule: CharacterAliasRule = {
      id: 'alias-1',
      label: '정체 공개',
      display_name: '',
      display_icon_url: '',
      priority: 1,
      condition: { id: 'group-1', operator: 'AND', rules: [{ id: 'rule-1', variable: 'custom_flag', target_flag_key: 'alias_ready', comparator: '=', value: 'true' }] },
    };

    renderEditor({ rules: [rule], onSave });
    fireEvent.click(screen.getByRole('button', { name: '플레이 중 표시 저장' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('표시 이름 또는 표시 아이콘을 입력하세요.')).toBeTruthy();
  });

  it('캐릭터가 바뀌면 이전 검증 메시지를 지운다', () => {
    const incompleteRule: CharacterAliasRule = {
      id: 'alias-1',
      display_name: '',
      display_icon_url: '',
      priority: 1,
      condition: { id: 'group-1', operator: 'AND', rules: [{ id: 'rule-1', variable: 'custom_flag', target_flag_key: 'alias_ready', comparator: '=', value: 'true' }] },
    };
    const completeRule: CharacterAliasRule = {
      id: 'alias-2',
      display_name: '목격자',
      priority: 1,
      condition: { id: 'group-1', operator: 'AND', rules: [{ id: 'rule-1', variable: 'custom_flag', target_flag_key: 'alias_ready', comparator: '=', value: 'true' }] },
    };
    const { rerender } = render(
      <CharacterAliasRulesEditor
        themeId="theme-1"
        characterName="홍길동"
        characterImageUrl="https://cdn.example/base.webp"
        rules={[incompleteRule]}
        characterOptions={characterOptions}
        disabled={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '플레이 중 표시 저장' }));
    expect(screen.getByText('표시 이름 또는 표시 아이콘을 입력하세요.')).toBeTruthy();

    rerender(
      <CharacterAliasRulesEditor
        themeId="theme-1"
        characterName="김영희"
        characterImageUrl="https://cdn.example/next.webp"
        rules={[completeRule]}
        characterOptions={characterOptions}
        disabled={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByText('표시 이름 또는 표시 아이콘을 입력하세요.')).toBeNull();
  });
});
