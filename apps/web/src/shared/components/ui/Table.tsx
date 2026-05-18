import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';

export interface TableColumn<T> {
  id: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  error?: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  className?: string;
}

const alignClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

export function Table<T>({
  columns,
  data,
  getRowKey,
  emptyTitle = '표시할 항목이 없습니다',
  emptyDescription,
  error,
  isLoading = false,
  loadingLabel,
  className = '',
}: TableProps<T>) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--mmp-color-hairline)]">
          <thead className="bg-[var(--mmp-color-surface-soft)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-normal text-[var(--mmp-color-steel)] ${alignClasses[column.align ?? 'left']} ${column.className ?? ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--mmp-color-hairline)]">
            {data.map((row) => (
              <tr key={getRowKey(row)} className="hover:bg-[var(--mmp-color-surface-soft)]">
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`px-4 py-3 text-sm text-[var(--mmp-color-charcoal)] ${alignClasses[column.align ?? 'left']} ${column.className ?? ''}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isLoading && <LoadingState label={loadingLabel ?? '표를 불러오는 중'} />}
      {!isLoading && error && <TableEmptyState title="표를 불러오지 못했습니다" description={error} />}
      {!isLoading && !error && data.length === 0 && (
        <TableEmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </div>
  );
}

export interface TableToolbarProps {
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}

export function TableToolbar({ title, action, children }: TableToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {title && <h3 className="text-sm font-semibold text-[var(--mmp-color-ink)]">{title}</h3>}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export interface TableEmptyStateProps {
  title: string;
  description?: ReactNode;
}

export function TableEmptyState({ title, description }: TableEmptyStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      className="border-t border-[var(--mmp-color-hairline)]"
    />
  );
}
