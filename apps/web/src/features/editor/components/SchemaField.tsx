import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/shared/components/ui/Input";
import { Select } from "@/shared/components/ui/Select";
import type { JSONSchemaProperty } from "@/features/editor/templateApi";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SchemaFieldProps {
  schema: JSONSchemaProperty;
  path: string;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveValue(value: unknown, schema: JSONSchemaProperty): unknown {
  if (value !== undefined && value !== null) return value;
  if (schema.default !== undefined) return schema.default;
  return undefined;
}

// ---------------------------------------------------------------------------
// SchemaField
// ---------------------------------------------------------------------------

export function SchemaField({ schema, path, value, onChange }: SchemaFieldProps) {
  const resolved = resolveValue(value, schema);
  const label = schema.title ?? path.split(".").pop() ?? path;
  const labelEl = (
    <span className="block text-sm font-medium text-slate-300">{label}</span>
  );
  const helpEl = schema.description ? (
    <span className="block text-xs text-slate-500">{schema.description}</span>
  ) : null;

  // ── enum → Select ──────────────────────────────────────────────────────────
  if (schema.type === "string" && schema.enum) {
    const options = schema.enum.map((v) => ({ value: v, label: v }));
    return (
      <div className="space-y-0.5">
        <Select
          label={label}
          options={options}
          value={typeof resolved === "string" ? resolved : ""}
          onChange={(e) => onChange(path, e.target.value)}
          placeholder="선택하세요"
        />
        {helpEl}
      </div>
    );
  }

  // ── string → text Input ────────────────────────────────────────────────────
  if (schema.type === "string") {
    return (
      <div className="space-y-0.5">
        <Input
          label={label}
          type="text"
          value={typeof resolved === "string" ? resolved : ""}
          onChange={(e) => onChange(path, e.target.value)}
        />
        {helpEl}
      </div>
    );
  }

  // ── number / integer → number Input ───────────────────────────────────────
  if (schema.type === "number" || schema.type === "integer") {
    return (
      <div className="space-y-0.5">
        <Input
          label={label}
          type="number"
          value={typeof resolved === "number" ? String(resolved) : ""}
          min={schema.minimum}
          max={schema.maximum}
          onChange={(e) => {
            const n = schema.type === "integer"
              ? parseInt(e.target.value, 10)
              : parseFloat(e.target.value);
            onChange(path, isNaN(n) ? undefined : n);
          }}
        />
        {helpEl}
      </div>
    );
  }

  // ── boolean → checkbox ─────────────────────────────────────────────────────
  if (schema.type === "boolean") {
    return (
      <div className="flex flex-col gap-0.5">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={typeof resolved === "boolean" ? resolved : false}
            onChange={(e) => onChange(path, e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900"
          />
          {labelEl}
        </label>
        {helpEl}
      </div>
    );
  }

  // ── array → list with add/remove ───────────────────────────────────────────
  if (schema.type === "array") {
    const items = Array.isArray(resolved) ? (resolved as unknown[]) : [];
    const itemSchema = schema.items ?? { type: "string" as const };

    function handleItemChange(idx: number, val: unknown) {
      const next = [...items];
      next[idx] = val;
      onChange(path, next);
    }

    function handleAdd() {
      onChange(path, [...items, itemSchema.default ?? ""]);
    }

    function handleRemove(idx: number) {
      onChange(path, items.filter((_, i) => i !== idx));
    }

    return (
      <div className="space-y-2">
        {labelEl}
        {helpEl}
        <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-800/40 p-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="flex-1">
                <SchemaField
                  schema={itemSchema}
                  path={`${path}.${idx}`}
                  value={item}
                  onChange={(_, val) => handleItemChange(idx, val)}
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="mt-1 rounded p-1 text-slate-500 hover:text-red-400 transition-colors"
                aria-label="항목 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            항목 추가
          </button>
        </div>
      </div>
    );
  }

  // ── object → recursive SchemaFields ───────────────────────────────────────
  if (schema.type === "object" && schema.properties) {
    const obj = (resolved && typeof resolved === "object" && !Array.isArray(resolved))
      ? (resolved as Record<string, unknown>)
      : {};

    return (
      <div className="space-y-3">
        {labelEl}
        {helpEl}
        <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 space-y-3">
          {Object.entries(schema.properties).map(([key, childSchema]) => (
            <SchemaField
              key={key}
              schema={childSchema}
              path={`${path}.${key}`}
              value={obj[key]}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── fallback ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-0.5">
      <Input
        label={label}
        type="text"
        value={resolved !== undefined && resolved !== null ? String(resolved) : ""}
        onChange={(e) => onChange(path, e.target.value)}
      />
      {helpEl}
    </div>
  );
}
