interface WhisperTargetOption {
  id: string;
  nickname: string;
}

interface WhisperTargetSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: WhisperTargetOption[];
}

export function WhisperTargetSelect({ value, onChange, options }: WhisperTargetSelectProps) {
  return (
    <div className="border-b border-slate-800 px-3 py-2">
      <select
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">대상 선택...</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nickname}
          </option>
        ))}
      </select>
    </div>
  );
}
