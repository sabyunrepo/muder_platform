export interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  className = '',
  hoverable = false,
  onClick,
}: CardProps) {
  const hoverClass = hoverable
    ? 'hover:border-slate-700 hover:shadow-lg transition cursor-pointer'
    : '';

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900 p-4 ${hoverClass} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
