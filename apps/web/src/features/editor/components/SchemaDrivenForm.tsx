import { Spinner } from "@/shared/components/ui/Spinner";
import type { TemplateSchema } from "@/features/editor/templateApi";
import { SchemaField } from "./SchemaField";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SchemaDrivenFormProps {
  schema: TemplateSchema;
  values: Record<string, unknown>;
  onChange: (path: string, value: unknown) => void;
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// SchemaDrivenForm
// ---------------------------------------------------------------------------

export function SchemaDrivenForm({
  schema,
  values,
  onChange,
  isLoading = false,
}: SchemaDrivenFormProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const properties = schema.properties ?? {};
  const entries = Object.entries(properties);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-500">설정 가능한 항목이 없습니다.</p>
    );
  }

  return (
    <div className="space-y-5">
      {schema.title && (
        <h3 className="text-base font-semibold text-slate-200">{schema.title}</h3>
      )}
      {schema.description && (
        <p className="text-sm text-slate-400">{schema.description}</p>
      )}
      {entries.map(([key, fieldSchema]) => (
        <SchemaField
          key={key}
          schema={fieldSchema}
          path={key}
          value={values[key]}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
