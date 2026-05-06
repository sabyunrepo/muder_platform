import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntityTriggerPlacementCard } from '../EntityTriggerPlacementCard';
import { readModuleConfig } from '@/features/editor/utils/configShape';

vi.mock('@/features/editor/components/media/MediaPicker', () => ({
  MediaPicker: ({
    open,
    title,
    onSelect,
  }: {
    open: boolean;
    title?: string;
    onSelect: (media: { id: string }) => void;
  }) =>
    open ? (
      <button type="button" onClick={() => onSelect({ id: 'media-1' })}>
        {title}
      </button>
    ) : null,
}));

vi.mock('@/features/editor/flowApi', () => ({
  useFlowGraph: () => ({
    data: {
      nodes: [
        { id: 'scene-1', type: 'phase', data: { label: '조사 장면' } },
        { id: 'ending-1', type: 'ending', data: { label: '진엔딩' } },
      ],
    },
  }),
}));

vi.mock('@/features/editor/readingApi', () => ({
  useReadingSections: () => ({
    data: [],
  }),
}));

afterEach(cleanup);

describe('EntityTriggerPlacementCard', () => {
  it('adds a clue trigger and writes it to event_progression placement config', () => {
    const onConfigChange = vi.fn();

    render(
      <EntityTriggerPlacementCard
        entityKind="clue"
        entityId="clue-1"
        entityName="단검"
        configJson={{}}
        onConfigChange={onConfigChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '트리거 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    fireEvent.click(screen.getByRole('button', { name: '트리거 저장' }));

    expect(onConfigChange).toHaveBeenCalledOnce();
    const [nextConfig] = onConfigChange.mock.calls[0];
    expect(readModuleConfig(nextConfig, 'event_progression')).toMatchObject({
      Triggers: [
        {
          placement: { kind: 'clue', entityId: 'clue-1' },
          actions: [{ type: 'OPEN_VOTING' }],
        },
      ],
    });
  });

  it('keeps save disabled until each trigger has at least one complete action', () => {
    render(
      <EntityTriggerPlacementCard
        entityKind="location"
        entityId="loc-1"
        entityName="서재"
        configJson={{}}
        onConfigChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '트리거 추가' }));

    expect(
      (screen.getByRole('button', { name: '트리거 저장' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      screen.getByText('저장하려면 이동할 장면이나 실행 결과를 추가하고 필요한 값을 채우세요.')
    ).toBeDefined();
  });

  it('keeps save disabled when a presentation cue is missing mediaId', () => {
    render(
      <EntityTriggerPlacementCard
        entityKind="location"
        entityId="loc-1"
        entityName="서재"
        configJson={{}}
        onConfigChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '트리거 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    fireEvent.change(screen.getByRole('combobox', { name: '장소 트리거 1 1 실행 결과' }), {
      target: { value: 'SET_BGM' },
    });

    expect(
      (screen.getByRole('button', { name: '트리거 저장' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('enables save after a presentation cue media is selected', () => {
    const onConfigChange = vi.fn();
    render(
      <EntityTriggerPlacementCard
        themeId="theme-1"
        entityKind="location"
        entityId="loc-1"
        entityName="서재"
        configJson={{}}
        onConfigChange={onConfigChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '트리거 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    fireEvent.change(screen.getByRole('combobox', { name: '장소 트리거 1 1 실행 결과' }), {
      target: { value: 'SET_BGM' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'BGM 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '장소 트리거 1 1 BGM 선택' }));

    const saveButton = screen.getByRole('button', { name: '트리거 저장' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);

    fireEvent.click(saveButton);

    expect(onConfigChange).toHaveBeenCalledOnce();
    const [nextConfig] = onConfigChange.mock.calls[0];
    expect(readModuleConfig(nextConfig, 'event_progression')).toMatchObject({
      Triggers: [
        {
          placement: { kind: 'location', entityId: 'loc-1' },
          actions: [{ type: 'SET_BGM', params: { mediaId: 'media-1' } }],
        },
      ],
    });
  });

  it('stores a target scene without requiring an extra action', () => {
    const onConfigChange = vi.fn();
    render(
      <EntityTriggerPlacementCard
        themeId="theme-1"
        entityKind="clue"
        entityId="clue-1"
        entityName="단검"
        configJson={{}}
        onConfigChange={onConfigChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '트리거 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '단서 트리거 1 플레이어 버튼 이름' }), {
      target: { value: '금고 암호 확인하기' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: '실행 후 이동할 장면' }), {
      target: { value: 'scene-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '트리거 저장' }));

    expect(onConfigChange).toHaveBeenCalledOnce();
    const [nextConfig] = onConfigChange.mock.calls[0];
    expect(readModuleConfig(nextConfig, 'event_progression')).toMatchObject({
      Triggers: [
        {
          placement: { kind: 'clue', entityId: 'clue-1' },
          label: '금고 암호 확인하기',
          to: 'scene-1',
        },
      ],
    });
  });
});
