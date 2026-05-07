export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 text-xs text-slate-500">
      <span className="mb-1 block">{label}</span>
      <select
        className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
