import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FlowNodeData } from '../../../flowTypes';
import { InformationDeliveryPanel } from '../InformationDeliveryPanel';
import { DELIVER_INFORMATION_ACTION } from '../phaseEditorAdapter';
import { GRANT_CLUE_ACTION } from '../../../entities/shared/actionAdapter';

const { useEditorCharactersMock, useEditorCluesMock, useStoryInfosMock } = vi.hoisted(() => ({
  useEditorCharactersMock: vi.fn(),
  useEditorCluesMock: vi.fn(),
  useStoryInfosMock: vi.fn(),
}));

vi.mock('../../../api', () => ({
  useEditorCharacters: () => useEditorCharactersMock(),
  useEditorClues: () => useEditorCluesMock(),
}));

vi.mock('../../../storyInfoApi', () => ({
  useStoryInfos: () => useStoryInfosMock(),
}));

vi.stubGlobal('crypto', { randomUUID: () => 'delivery-new' });

afterAll(() => {
  vi.unstubAllGlobals();
});

const characters = [
  { id: 'char-1', name: '탐정 A' },
  { id: 'char-2', name: '용의자 B' },
];

const storyInfos = [
  {
    id: 'info-1',
    themeId: 'theme-1',
    title: '숨겨진 단서',
    body: '모두가 확인해야 하는 공개 정보',
    imageMediaId: null,
    relatedCharacterIds: [],
    relatedClueIds: [],
    relatedLocationIds: [],
    sortOrder: 0,
    version: 1,
    createdAt: '2026-05-06T00:00:00Z',
    updatedAt: '2026-05-06T00:00:00Z',
  },
  {
    id: 'info-2',
    themeId: 'theme-1',
    title: '비밀 통로',
    body: '서재 뒤쪽에 통로가 있다',
    imageMediaId: 'media-1',
    relatedCharacterIds: [],
    relatedClueIds: [],
    relatedLocationIds: [],
    sortOrder: 1,
    version: 1,
    createdAt: '2026-05-06T00:00:00Z',
    updatedAt: '2026-05-06T00:00:00Z',
  },
];

const clues = [
  {
    id: 'clue-1',
    theme_id: 'theme-1',
    location_id: null,
    name: '혈흔',
    description: '현장에서 발견된 흔적',
    image_url: null,
    image_media_id: null,
    is_common: false,
    level: 1,
    sort_order: 0,
    created_at: '2026-05-06T00:00:00Z',
    is_usable: false,
    use_effect: null,
    use_target: null,
    use_consumed: false,
    reveal_round: 1,
    hide_round: null,
  },
  {
    id: 'clue-2',
    theme_id: 'theme-1',
    location_id: null,
    name: '비밀 편지',
    description: '봉인된 편지',
    image_url: null,
    image_media_id: null,
    is_common: false,
    level: 1,
    sort_order: 1,
    created_at: '2026-05-06T00:00:00Z',
    is_usable: false,
    use_effect: null,
    use_target: null,
    use_consumed: false,
    reveal_round: 2,
    hide_round: null,
  },
];

beforeEach(() => {
  useEditorCharactersMock.mockReturnValue({
    data: characters,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useStoryInfosMock.mockReturnValue({
    data: storyInfos,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  useEditorCluesMock.mockReturnValue({
    data: clues,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('InformationDeliveryPanel', () => {
  it('모든 페이즈에서 캐릭터별 장면 진입 효과 설정을 추가할 수 있다', () => {
    const onChange = vi.fn();
    render(<InformationDeliveryPanel themeId="theme-1" phaseData={{}} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '캐릭터별 대상 추가' }));

    expect(screen.getByText('받을 캐릭터를 선택하세요 · 정보 0개 · 단서 0개')).toBeDefined();
    expect(onChange).toHaveBeenCalledWith({ onEnter: [] });
  });

  it('캐릭터, 공개 정보, 단서를 검색하고 선택/삭제할 수 있다', () => {
    const onChange = vi.fn();
    const phaseData: FlowNodeData = {
      onEnter: [
        {
          id: 'info',
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: 'd1',
                target: { type: 'character' },
                story_info_ids: ['info-1'],
              },
            ],
          },
        },
      ],
    };

    render(
      <InformationDeliveryPanel themeId="theme-1" phaseData={phaseData} onChange={onChange} />
    );

    fireEvent.change(screen.getByPlaceholderText('이름으로 찾기'), {
      target: { value: '용의자' },
    });
    fireEvent.click(screen.getByRole('button', { name: /용의자 B/ }));

    expect(onChange).toHaveBeenLastCalledWith({
      onEnter: [
        {
          id: 'info',
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: 'd1',
                target: { type: 'character', character_id: 'char-2' },
                reading_section_ids: [],
                story_info_ids: ['info-1'],
              },
            ],
          },
        },
      ],
    });

    fireEvent.change(screen.getByPlaceholderText('정보 제목으로 찾기'), {
      target: { value: '비밀' },
    });
    fireEvent.click(screen.getByRole('button', { name: /비밀 통로/ }));

    expect(onChange).toHaveBeenLastCalledWith({
      onEnter: [
        {
          id: 'info',
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: 'd1',
                target: { type: 'character', character_id: 'char-2' },
                reading_section_ids: [],
                story_info_ids: ['info-1', 'info-2'],
              },
            ],
          },
        },
      ],
    });

    fireEvent.change(screen.getByPlaceholderText('단서 이름으로 찾기'), {
      target: { value: '편지' },
    });
    fireEvent.click(screen.getByRole('button', { name: /비밀 편지/ }));

    expect(onChange).toHaveBeenLastCalledWith({
      onEnter: [
        {
          id: 'info',
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: 'd1',
                target: { type: 'character', character_id: 'char-2' },
                reading_section_ids: [],
                story_info_ids: ['info-1', 'info-2'],
              },
            ],
          },
        },
        {
          id: 'delivery-new',
          type: GRANT_CLUE_ACTION,
          params: {
            deliveries: [
              {
                id: 'd1',
                target: { type: 'character', character_id: 'char-2' },
                clue_ids: ['clue-2'],
              },
            ],
          },
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: '진입 효과 1 삭제' }));
    expect(onChange).toHaveBeenLastCalledWith({ onEnter: [] });
  });

  it('캐릭터 또는 정보 조회 실패를 빈 상태와 구분하고 재시도할 수 있다', () => {
    const refetchCharacters = vi.fn();
    const refetchStoryInfos = vi.fn();
    useEditorCharactersMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: refetchCharacters,
    });
    useStoryInfosMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: refetchStoryInfos,
    });
    useEditorCluesMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    render(<InformationDeliveryPanel themeId="theme-1" phaseData={{}} onChange={vi.fn()} />);

    expect(
      screen.getByText('장면 진입 효과에 필요한 캐릭터, 정보, 단서 목록을 불러오지 못했습니다.')
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));

    expect(refetchCharacters).toHaveBeenCalledTimes(1);
    expect(refetchStoryInfos).toHaveBeenCalledTimes(1);
  });

  it('옵션 목록이 비어도 저장된 장면 진입 효과는 계속 표시한다', () => {
    useStoryInfosMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useEditorCluesMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    const phaseData: FlowNodeData = {
      onEnter: [
        {
          id: 'info',
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: 'd1',
                target: { type: 'character', character_id: 'char-1' },
                story_info_ids: ['missing-info'],
              },
            ],
          },
        },
      ],
    };

    render(<InformationDeliveryPanel themeId="theme-1" phaseData={phaseData} onChange={vi.fn()} />);

    expect(screen.getByText('탐정 A · 정보 1개 · 단서 0개')).toBeDefined();
    expect(screen.queryByText(/연결할 정보나 단서가 없습니다/)).toBeNull();
  });

  it('phaseData onEnter 변경이 들어오면 저장된 장면 연결 설정을 다시 반영한다', () => {
    const firstPhaseData: FlowNodeData = {
      onEnter: [
        {
          id: 'info',
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: 'd1',
                target: { type: 'character', character_id: 'char-1' },
                reading_section_ids: ['rs-1'],
                story_info_ids: ['info-1'],
              },
            ],
          },
        },
      ],
    };
    const nextPhaseData: FlowNodeData = {
      onEnter: [
        {
          id: 'info',
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: 'd2',
                target: { type: 'character', character_id: 'char-2' },
                reading_section_ids: ['rs-2'],
                story_info_ids: [],
              },
            ],
          },
        },
      ],
    };

    const { rerender } = render(
      <InformationDeliveryPanel themeId="theme-1" phaseData={firstPhaseData} onChange={vi.fn()} />
    );
    expect(screen.getByText('탐정 A · 정보 1개 · 단서 0개')).toBeDefined();

    rerender(
      <InformationDeliveryPanel themeId="theme-1" phaseData={nextPhaseData} onChange={vi.fn()} />
    );

    expect(screen.queryByText('용의자 B · 정보 0개 · 단서 0개')).toBeNull();
  });

  it('캐릭터가 없으면 캐릭터별 대상 추가를 비활성화하고 안내한다', () => {
    useEditorCharactersMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<InformationDeliveryPanel themeId="theme-1" phaseData={{}} onChange={vi.fn()} />);

    expect(
      (screen.getByRole('button', { name: '캐릭터별 대상 추가' }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(
      screen.getByText(
        '아직 장면 진입 효과 대상이 없습니다. 전체 대상 추가를 눌러 모든 플레이어에게 적용할 효과를 연결해 주세요.'
      )
    ).toBeDefined();
  });

  it('모든 페이즈에서 모든 플레이어 공통 전달을 추가할 수 있다', () => {
    const onChange = vi.fn();
    render(
      <InformationDeliveryPanel
        themeId="theme-1"
        phaseData={{ phase_type: 'investigation' }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '전체 대상 추가' }));

    expect(screen.getByText('모든 플레이어 · 정보 0개 · 단서 0개')).toBeDefined();
    expect(onChange).toHaveBeenCalledWith({ onEnter: [] });
  });
});
