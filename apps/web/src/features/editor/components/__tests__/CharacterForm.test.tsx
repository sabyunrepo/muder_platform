import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { EditorCharacterResponse } from '@/features/editor/api';

const {
  useCreateCharacterMock,
  useUpdateCharacterMock,
  createCharacterMutateMock,
  updateCharacterMutateMock,
} = vi.hoisted(() => ({
  useCreateCharacterMock: vi.fn(),
  useUpdateCharacterMock: vi.fn(),
  createCharacterMutateMock: vi.fn(),
  updateCharacterMutateMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/features/editor/api', () => ({
  useCreateCharacter: () => useCreateCharacterMock(),
  useUpdateCharacter: () => useUpdateCharacterMock(),
}));

vi.mock('@/shared/components/ui/Modal', () => ({
  Modal: ({
    isOpen,
    children,
    footer,
    title,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    footer: React.ReactNode;
    title: string;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
        {footer}
      </div>
    ) : null,
}));

vi.mock('@/shared/components/ui/Button', () => ({
  Button: ({
    children,
    onClick,
    type,
    form,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit';
    form?: string;
    disabled?: boolean;
  }) => (
    <button type={type ?? 'button'} form={form} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/shared/components/ui/Input', () => ({
  Input: ({
    label,
    value,
    onChange,
    error,
    ...rest
  }: {
    label?: string;
    value: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    error?: string;
    [key: string]: unknown;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value}
        onChange={onChange}
        {...(rest as Record<string, unknown>)}
      />
      {error && <span role="alert">{error}</span>}
    </label>
  ),
}));

import { CharacterForm } from '../CharacterForm';

const character: EditorCharacterResponse = {
  id: 'char-1',
  theme_id: 'theme-1',
  name: '홍길동',
  description: '공개 소개',
  image_url: 'https://cdn.example/character.webp',
  is_culprit: false,
  mystery_role: 'suspect',
  sort_order: 0,
  is_playable: true,
  show_in_intro: true,
  can_speak_in_reading: true,
  is_voting_candidate: true,
  endcard_title: null,
  endcard_body: null,
  endcard_image_url: null,
  alias_rules: [],
};

describe('CharacterForm', () => {
  beforeEach(() => {
    useCreateCharacterMock.mockReturnValue({ mutate: createCharacterMutateMock, isPending: false });
    useUpdateCharacterMock.mockReturnValue({ mutate: updateCharacterMutateMock, isPending: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('생성 모달은 상세 기본정보와 겹치는 필드를 숨긴다', () => {
    render(<CharacterForm themeId="theme-1" isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: '캐릭터 추가' })).toBeDefined();
    expect(screen.getByLabelText('이름')).toBeDefined();
    expect(screen.queryByLabelText('설명')).toBeNull();
    expect(screen.queryByText('캐릭터 이미지')).toBeNull();
    expect(screen.queryByLabelText(/범인 여부/)).toBeNull();
    expect(screen.queryByLabelText('정렬 순서')).toBeNull();
  });

  it('생성 요청은 이름만 보낸 뒤 나머지는 기본정보에서 관리하게 한다', () => {
    render(<CharacterForm themeId="theme-1" isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '새 인물' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(createCharacterMutateMock).toHaveBeenCalledWith(
      { name: '새 인물' },
      expect.any(Object),
    );
  });

  it('수정 모달도 이미지 슬롯은 상세 기본정보에서만 관리하게 한다', () => {
    render(<CharacterForm themeId="theme-1" character={character} isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: '캐릭터 수정' })).toBeDefined();
    expect(screen.getByLabelText('설명')).toBeDefined();
    expect(screen.queryByText('캐릭터 이미지')).toBeNull();
    expect(screen.getByLabelText(/범인 여부/)).toBeDefined();
    expect(screen.getByLabelText('정렬 순서')).toBeDefined();
  });
});
