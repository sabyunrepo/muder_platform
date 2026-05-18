import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeLabel?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeLabel = '닫기',
}: ModalProps) {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const modalEl = modalRef.current;
    if (!modalEl) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const firstFocusable = modalEl.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? modalEl).focus();

    function handleTabKey(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;

      const focusables = Array.from(
        modalEl.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((node) => !node.hasAttribute('disabled'));

      if (focusables.length === 0) {
        event.preventDefault();
        modalEl.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    modalEl.addEventListener('keydown', handleTabKey);
    return () => {
      modalEl.removeEventListener('keydown', handleTabKey);
      previousFocus?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 cursor-default bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`relative flex max-h-[90vh] w-full flex-col rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] text-[var(--mmp-color-ink)] shadow-[var(--mmp-shadow-modal)] ${sizeClasses[size]}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--mmp-color-hairline)] px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-[var(--mmp-color-ink)]">
            {title}
          </h2>
          <IconButton
            icon={<X className="h-5 w-5" />}
            label={closeLabel}
            onClick={onClose}
            size="sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--mmp-color-hairline)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
