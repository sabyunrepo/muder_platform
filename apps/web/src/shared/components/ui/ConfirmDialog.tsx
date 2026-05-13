import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: 'danger' | 'warning';
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  isConfirming = false,
  onCancel,
  onConfirm,
  tone = 'danger',
}: ConfirmDialogProps) {
  const iconClasses =
    tone === 'danger'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-300';

  return (
    <Modal
      isOpen={isOpen}
      onClose={isConfirming ? () => undefined : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isConfirming}
            aria-label={confirmLabel}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3 text-sm text-slate-300">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border ${iconClasses}`}
          aria-hidden="true"
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 leading-6">
          {typeof description === 'string' ? (
            <p className="whitespace-pre-line">{description}</p>
          ) : (
            description
          )}
        </div>
      </div>
    </Modal>
  );
}
