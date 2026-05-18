import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Checkbox, Input, Select, Switch, Textarea } from '../index';

afterEach(() => {
  cleanup();
});

describe('form controls', () => {
  it('Input links label, description, and error with accessible attributes', () => {
    render(
      <Input
        label="이름"
        description="표시되는 이름입니다"
        error="이름을 입력하세요"
      />,
    );

    const input = screen.getByLabelText('이름');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain('-error');
    expect(screen.getByText('이름을 입력하세요')).toBeDefined();
  });

  it('Textarea renders as a labeled multiline field', () => {
    render(<Textarea label="설명" />);

    expect(screen.getByLabelText('설명').tagName).toBe('TEXTAREA');
  });

  it('Select renders options and error state', () => {
    render(
      <Select
        label="난이도"
        error="난이도를 선택하세요"
        options={[{ value: 'easy', label: '쉬움' }]}
      />,
    );

    expect(screen.getByRole('combobox', { name: '난이도' })).toBeDefined();
    expect(screen.getByRole('option', { name: '쉬움' })).toBeDefined();
    expect(screen.getByText('난이도를 선택하세요')).toBeDefined();
  });

  it('Checkbox exposes label and description', () => {
    render(<Checkbox label="공개" description="사용자에게 보입니다" />);

    expect(screen.getByRole('checkbox', { name: /공개/ })).toBeDefined();
    expect(screen.getByText('사용자에게 보입니다')).toBeDefined();
  });

  it('Switch exposes switch role and checked state', () => {
    render(<Switch label="시스템 알림" defaultChecked />);

    const control = screen.getByRole('switch', { name: '시스템 알림' });
    expect(control).toHaveProperty('checked', true);
  });
});
