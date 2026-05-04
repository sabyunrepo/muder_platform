import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntityTriggerPlacementCard } from '../EntityTriggerPlacementCard';
import { readModuleConfig } from '@/features/editor/utils/configShape';

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

  it('keeps save disabled until each trigger has at least one action', () => {
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
    expect(screen.getByText('저장하려면 실행 결과를 하나 이상 추가하세요.')).toBeDefined();
  });
});
