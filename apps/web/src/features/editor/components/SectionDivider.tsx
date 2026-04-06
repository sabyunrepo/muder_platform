// ---------------------------------------------------------------------------
// SectionDivider
// ---------------------------------------------------------------------------

interface SectionDividerProps {
  label: string;
}

export function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-slate-800" />
      <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-700">
        {label}
      </span>
      <span className="h-px flex-1 bg-slate-800" />
    </div>
  );
}
