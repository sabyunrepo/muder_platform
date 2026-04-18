import { Send } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// ChatInput
// ---------------------------------------------------------------------------

/**
 * Text input + send button row for chat panels.
 */
export function ChatInput({
  value,
  onChange,
  onSend,
  placeholder = "메시지를 입력하세요...",
  disabled = false,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex items-center gap-2 border-t border-slate-800 p-3">
      <input
        className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={placeholder}
      />
      <button
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-600 text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        aria-label="메시지 전송"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
