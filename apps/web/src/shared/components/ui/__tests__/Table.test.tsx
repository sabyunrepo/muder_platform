import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Table, TableToolbar, type TableColumn } from '../index';

afterEach(() => {
  cleanup();
});

interface Row {
  id: string;
  name: string;
  status: string;
}

const columns: TableColumn<Row>[] = [
  { id: 'name', header: '이름', render: (row) => row.name },
  { id: 'status', header: '상태', render: (row) => row.status },
];

describe('Table', () => {
  it('renders headers and rows', () => {
    render(
      <Table
        columns={columns}
        data={[{ id: '1', name: '테마 A', status: '공개' }]}
        getRowKey={(row) => row.id}
      />,
    );

    expect(screen.getByRole('columnheader', { name: '이름' })).toBeDefined();
    expect(screen.getByRole('cell', { name: '테마 A' })).toBeDefined();
    expect(screen.getByRole('cell', { name: '공개' })).toBeDefined();
  });

  it('renders empty state', () => {
    render(
      <Table
        columns={columns}
        data={[]}
        getRowKey={(row) => row.id}
        emptyTitle="테마가 없습니다"
      />,
    );

    expect(screen.getByText('테마가 없습니다')).toBeDefined();
  });

  it('renders loading state', () => {
    render(
      <Table
        columns={columns}
        data={[]}
        getRowKey={(row) => row.id}
        isLoading
        loadingLabel="테마 로딩"
      />,
    );

    expect(screen.getByRole('status', { name: '테마 로딩' })).toBeDefined();
  });

  it('renders error state', () => {
    render(
      <Table
        columns={columns}
        data={[]}
        getRowKey={(row) => row.id}
        error="네트워크 오류"
      />,
    );

    expect(screen.getByText('표를 불러오지 못했습니다')).toBeDefined();
    expect(screen.getByText('네트워크 오류')).toBeDefined();
  });

  it('renders toolbar title and action', () => {
    render(<TableToolbar title="테마 목록" action={<button type="button">추가</button>} />);

    expect(screen.getByText('테마 목록')).toBeDefined();
    expect(screen.getByRole('button', { name: '추가' })).toBeDefined();
  });
});
