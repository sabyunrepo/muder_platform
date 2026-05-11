import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { MissionEditor } from '../MissionEditor';
import type { Mission } from '../MissionEditor';

afterEach(cleanup);

const noop = vi.fn();

const baseMission = (overrides: Partial<Mission> = {}): Mission => ({
  id: 'mission-1',
  type: 'kill',
  description: '테스트 미션',
  points: 10,
  ...overrides,
});

const mockCharacters = [
  { id: 'char-1', name: '홍길동' },
  { id: 'char-2', name: '김철수' },
];

const mockClues = [
  { id: 'clue-1', name: '피 묻은 칼' },
  { id: 'clue-2', name: '비밀 편지' },
];

describe('MissionEditor', () => {
  it('미션이 없으면 안내 메시지를 표시한다', () => {
    render(<MissionEditor missions={[]} onAdd={noop} onChange={noop} onDelete={noop} />);
    expect(screen.getByText('미션이 없습니다')).toBeDefined();
  });

  it('추가 버튼 클릭 시 onAdd가 호출된다', () => {
    const onAdd = vi.fn();
    render(<MissionEditor missions={[]} onAdd={onAdd} onChange={noop} onDelete={noop} />);
    fireEvent.click(screen.getByText('추가'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('kill 타입 선택 시 대상 캐릭터·공모 조건 필드가 렌더링된다', () => {
    render(
      <MissionEditor
        missions={[baseMission({ type: 'kill' })]}
        characters={mockCharacters}
        clues={mockClues}
        onAdd={noop}
        onChange={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('대상 캐릭터')).toBeDefined();
    expect(screen.getByText('공모 조건')).toBeDefined();
  });

  it('possess 타입 선택 시 대상 단서·수량 필드가 렌더링된다', () => {
    render(
      <MissionEditor
        missions={[baseMission({ type: 'possess' })]}
        characters={mockCharacters}
        clues={mockClues}
        onAdd={noop}
        onChange={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('대상 단서')).toBeDefined();
    expect(screen.getByText('수량')).toBeDefined();
  });

  it('secret 타입 선택 시 비밀 내용·패널티·난이도 필드가 렌더링된다', () => {
    render(
      <MissionEditor
        missions={[baseMission({ type: 'secret' })]}
        onAdd={noop}
        onChange={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('비밀 내용')).toBeDefined();
    expect(screen.getByText('패널티')).toBeDefined();
    expect(screen.getByText('난이도 (1–5)')).toBeDefined();
  });

  it('protect 타입 선택 시 대상 캐릭터·단서·조건 필드가 렌더링된다', () => {
    render(
      <MissionEditor
        missions={[baseMission({ type: 'protect' })]}
        characters={mockCharacters}
        clues={mockClues}
        onAdd={noop}
        onChange={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getAllByText('대상 캐릭터').length).toBeGreaterThan(0);
    expect(screen.getAllByText('대상 단서').length).toBeGreaterThan(0);
    expect(screen.getByText('조건')).toBeDefined();
  });

  it('미션 삭제 버튼 클릭 시 onDelete가 호출된다', () => {
    const onDelete = vi.fn();
    render(
      <MissionEditor
        missions={[baseMission()]}
        onAdd={noop}
        onChange={onDelete}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByLabelText('미션 삭제'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('미션 공개 시점 선택 없이 미션 공개 장면과 백엔드 판정 경계를 표시한다', () => {
    const onChange = vi.fn();
    render(
      <MissionEditor
        missions={[baseMission({ type: 'secret', visibleFrom: 'intro_end', revealNodeId: 'intro_finished' })]}
        onAdd={noop}
        onChange={onChange}
        onDelete={noop}
      />,
    );

    expect(screen.queryByLabelText('미션 공개 시점')).toBeNull();
    expect(screen.getByLabelText('미션 공개 장면')).toBeDefined();
    expect(screen.getByText('저장된 장면 intro_finished 도달 후 공개')).toBeDefined();
    expect(screen.getByText('엔진 연동 필요')).toBeDefined();
    expect(screen.getByText('게임 판정은 백엔드가 담당')).toBeDefined();
  });

  it('미션 공개 장면 입력을 저장한다', () => {
    const onChange = vi.fn();
    render(
      <MissionEditor
        missions={[baseMission({ visibleFrom: 'node_reached', revealNodeId: 'intro_finished' })]}
        onAdd={noop}
        onChange={onChange}
        onDelete={noop}
      />,
    );
    fireEvent.change(screen.getByLabelText('미션 공개 장면'), {
      target: { value: 'voting_started' },
    });
    expect(onChange).toHaveBeenCalledWith('mission-1', 'revealNodeId', 'voting_started');
  });

  it('실제 flow/round 후보를 공개 시점 selector에 사용한다', () => {
    render(
      <MissionEditor
        missions={[baseMission({ visibleFrom: 'node_reached', revealNodeId: 'scene-2' })]}
        roundOptions={[{ value: 1, label: '1라운드' }, { value: 2, label: '2라운드' }]}
        nodeOptions={[
          { value: 'scene-1', label: '오프닝 (장면)' },
          { value: 'scene-2', label: '현장 조사 (장면)' },
        ]}
        onAdd={noop}
        onChange={noop}
        onDelete={noop}
      />,
    );

    expect(screen.getByRole('option', { name: '현장 조사 (장면)' })).toBeDefined();
    expect(screen.queryByRole('option', { name: '투표 시작' })).toBeNull();
  });

  it('MISSION_TYPES에 kill/possess/secret/protect가 포함된다', () => {
    render(
      <MissionEditor
        missions={[baseMission()]}
        onAdd={noop}
        onChange={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('살해')).toBeDefined();
    expect(screen.getByText('보유')).toBeDefined();
    expect(screen.getByText('비밀')).toBeDefined();
    expect(screen.getByText('보호')).toBeDefined();
  });
});
