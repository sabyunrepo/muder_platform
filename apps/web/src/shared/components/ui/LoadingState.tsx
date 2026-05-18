import { Spinner } from './Spinner';

export interface LoadingStateProps {
  label?: string;
  description?: string;
  className?: string;
}

export function LoadingState({
  label = '불러오는 중',
  description,
  className = '',
}: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      <Spinner label={label} />
      <p className="mt-3 text-sm font-medium text-[var(--mmp-color-charcoal)]">{label}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--mmp-color-steel)]">
          {description}
        </p>
      )}
    </div>
  );
}
