import { cleanup, render, screen } from '@testing-library/react';
import type { Edge, Node } from '@xyflow/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BranchNodePanel } from '../BranchNodePanel';

vi.mock('@/features/editor/hooks/useFlowConditionData', () => ({
  useFlowConditionData: () => ({ characters: [], clues: [] }),
}));

const baseNode: Node = {
  id: 'branch-node',
  type: 'branch',
  position: { x: 0, y: 0 },
  data: { label: '조건 분기' },
};

function renderPanel(edges: Edge[]) {
  return render(
    <BranchNodePanel
      node={baseNode}
      themeId="theme-1"
      edges={edges}
      onUpdate={vi.fn()}
      onEdgeConditionChange={vi.fn()}
    />
  );
}

describe('BranchNodePanel', () => {
  afterEach(() => cleanup());

  it('라벨 없는 edge를 내부 ID 대신 제작자용 분기명으로 표시한다', () => {
    const { container } = renderPanel([
      {
        id: 'edge-internal-123',
        source: 'branch-node',
        target: 'phase-a',
        data: {},
      },
    ]);

    expect(screen.getAllByText('분기 1').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('기본 경로 (조건 없이 통과)')).toBeDefined();
    expect(container.textContent).not.toContain('edge-internal-123');
  });

  it('조건 요약을 raw JSON 없이 표시한다', () => {
    const { container } = renderPanel([
      {
        id: 'edge-with-condition',
        source: 'branch-node',
        target: 'phase-a',
        data: {
          condition: {
            operator: 'OR',
            rules: [{ id: 'rule-1' }],
          },
        },
      },
    ]);

    expect(screen.getByText('하나 이상 · 1개 규칙')).toBeDefined();
    expect(container.textContent).not.toContain('edge-with-condition');
  });
});
