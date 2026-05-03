import { describe, it, expect, vi, afterEach, beforeEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

// jsdom lacks URL.createObjectURL / revokeObjectURL
beforeAll(() => {
  if (!('createObjectURL' in URL)) {
    (URL as unknown as { createObjectURL: (f: File) => string }).createObjectURL = () =>
      'blob:mock';
  }
  if (!('revokeObjectURL' in URL)) {
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  }
});

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  useCreateClueMock,
  useUpdateClueMock,
  mergeClueImageMock,
  uploadImageMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  useCreateClueMock: vi.fn(),
  useUpdateClueMock: vi.fn(),
  mergeClueImageMock: vi.fn(),
  uploadImageMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

vi.mock('@/features/editor/api', () => ({
  useCreateClue: () => useCreateClueMock(),
  useUpdateClue: () => useUpdateClueMock(),
}));

vi.mock('@/features/editor/editorClueApi', () => ({
  mergeClueImage: mergeClueImageMock,
}));

vi.mock('@/features/editor/imageApi', () => ({
  uploadImage: uploadImageMock,
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

vi.mock('../ImageUpload', () => ({
  ImageUpload: () => <div data-testid="image-upload" />,
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { ClueForm } from '../ClueForm';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

afterEach(cleanup);

describe('ClueForm', () => {
  let createMutate: ReturnType<typeof vi.fn>;
  let updateMutate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createMutate = vi.fn();
    updateMutate = vi.fn();
    useCreateClueMock.mockReturnValue({ mutate: createMutate, isPending: false });
    useUpdateClueMock.mockReturnValue({ mutate: updateMutate, isPending: false });
    mergeClueImageMock.mockReset();
    uploadImageMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('create 모드에서 이름 입력 후 저장하면 useCreateClue.mutate가 호출된다', () => {
    const onClose = vi.fn();
    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    const nameInput = screen.getByLabelText('이름') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: '증거물' } });

    fireEvent.submit(document.getElementById('clue-form')!);

    expect(createMutate).toHaveBeenCalledTimes(1);
    const [body] = createMutate.mock.calls[0];
    expect(body.name).toBe('증거물');
    expect(body.is_usable).toBe(false);
  });

  it('create 성공 후 pendingImage가 있으면 uploadImage + mergeClueImage가 호출된다', async () => {
    uploadImageMock.mockResolvedValueOnce('https://cdn/clue.png');
    const onClose = vi.fn();

    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    // 이름 입력
    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: 'with-image' },
    });

    // 파일 input에 파일 주입 (hidden input)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    const file = new File(['data'], 'test.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    // 저장
    fireEvent.submit(document.getElementById('clue-form')!);
    expect(createMutate).toHaveBeenCalledTimes(1);

    // onSuccess 시뮬레이션
    const [, options] = createMutate.mock.calls[0];
    await options.onSuccess({ id: 'new-clue-id' });

    expect(uploadImageMock).toHaveBeenCalledWith(
      'theme-1',
      'clue',
      'new-clue-id',
      expect.any(File),
      'image/png',
    );
    expect(mergeClueImageMock).toHaveBeenCalledWith(
      'theme-1',
      'new-clue-id',
      'https://cdn/clue.png',
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('edit 모드에서는 useUpdateClue.mutate가 호출된다', () => {
    const onClose = vi.fn();
    const existing = {
      id: 'clue-99',
      theme_id: 'theme-1',
      location_id: null,
      name: '기존 단서',
      description: null,
      image_url: null,
      is_common: false,
      level: 1,
      sort_order: 0,
      created_at: '2026-04-15T00:00:00Z',
      is_usable: false,
      use_effect: null,
      use_target: null,
      use_consumed: false,
    };

    render(
      <ClueForm themeId="theme-1" clue={existing} isOpen onClose={onClose} />,
    );

    fireEvent.submit(document.getElementById('clue-form')!);

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [args] = updateMutate.mock.calls[0];
    expect(args.clueId).toBe('clue-99');
    expect(args.body.name).toBe('기존 단서');
  });

  it('이름이 비어있으면 검증 에러를 표시하고 mutate는 호출되지 않는다', () => {
    const onClose = vi.fn();
    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    fireEvent.submit(document.getElementById('clue-form')!);

    expect(screen.getByRole('alert').textContent).toContain('이름은 필수');
    expect(createMutate).not.toHaveBeenCalled();
  });


  it('사용 효과 설정은 제작자가 이해하는 문장으로 표시된다', () => {
    const onClose = vi.fn();
    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    fireEvent.click(screen.getByText('고급 설정'));
    fireEvent.click(screen.getByLabelText('사용 가능한 단서'));

    expect(screen.getByText('다른 플레이어 단서 보기')).toBeDefined();
    expect(screen.getByText('다른 플레이어에게서 단서 가져오기')).toBeDefined();
    expect(screen.getByText('사용하면 내 단서함에서 사라짐')).toBeDefined();
  });

  it('고급 설정의 공개/사라짐 라운드 입력이 payload에 포함된다', () => {
    const onClose = vi.fn();
    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '라운드 단서' },
    });
    fireEvent.click(screen.getByText('고급 설정'));
    fireEvent.change(screen.getByLabelText('공개 라운드'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('사라짐 라운드'), {
      target: { value: '4' },
    });

    fireEvent.submit(document.getElementById('clue-form')!);

    expect(createMutate).toHaveBeenCalledTimes(1);
    const [body] = createMutate.mock.calls[0];
    expect(body.reveal_round).toBe(2);
    expect(body.hide_round).toBe(4);
  });

  it('공개 > 사라짐 라운드 조합은 에러를 표시하고 mutate를 막는다', () => {
    const onClose = vi.fn();
    render(<ClueForm themeId="theme-1" isOpen onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('이름'), {
      target: { value: '역전 단서' },
    });
    fireEvent.click(screen.getByText('고급 설정'));
    fireEvent.change(screen.getByLabelText('공개 라운드'), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText('사라짐 라운드'), {
      target: { value: '2' },
    });

    fireEvent.submit(document.getElementById('clue-form')!);

    expect(
      screen.getByText('공개 라운드는 사라짐 라운드보다 클 수 없습니다'),
    ).toBeDefined();
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('edit 모드에서 기존 reveal_round/hide_round가 초기값으로 로드된다', () => {
    const onClose = vi.fn();
    const existing = {
      id: 'clue-rr',
      theme_id: 'theme-1',
      location_id: null,
      name: '기존 단서',
      description: null,
      image_url: null,
      is_common: false,
      level: 1,
      sort_order: 0,
      created_at: '2026-04-17T00:00:00Z',
      is_usable: false,
      use_effect: null,
      use_target: null,
      use_consumed: false,
      reveal_round: 3,
      hide_round: 7,
    };

    render(
      <ClueForm themeId="theme-1" clue={existing} isOpen onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('고급 설정'));

    expect(
      (screen.getByLabelText('공개 라운드') as HTMLInputElement).value,
    ).toBe('3');
    expect(
      (screen.getByLabelText('사라짐 라운드') as HTMLInputElement).value,
    ).toBe('7');
  });
});
