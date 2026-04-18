import { useState } from 'react';

// ---------------------------------------------------------------------------
// AddNameInput — inline name input with add/cancel buttons
// ---------------------------------------------------------------------------

interface AddNameInputProps {
  placeholder: string;
  onAdd: (name: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function AddNameInput({ placeholder, onAdd, onCancel, isPending }: AddNameInputProps) {
  const [value, setValue] = useState('');

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && value.trim()) onAdd(value.trim());
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isPending}
        className="flex-1 min-w-0 rounded-sm bg-slate-800 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
      />
      <button
        type="button"
        onClick={() => value.trim() && onAdd(value.trim())}
        disabled={!value.trim() || isPending}
        className="text-[10px] text-amber-500 hover:text-amber-400 disabled:opacity-40 shrink-0"
      >
        추가
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-[10px] text-slate-600 hover:text-slate-400 shrink-0"
      >
        취소
      </button>
    </div>
  );
}
