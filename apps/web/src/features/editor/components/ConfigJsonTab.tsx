import { useState, useEffect } from "react";
import { toast } from "sonner";

import { Button, Badge } from "@/shared/components/ui";
import type { EditorThemeResponse } from "@/features/editor/api";
import { useUpdateConfigJson } from "@/features/editor/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfigJsonTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serialize(value: Record<string, unknown> | null): string {
  return JSON.stringify(value ?? {}, null, 2);
}

// ---------------------------------------------------------------------------
// ConfigJsonTab
// ---------------------------------------------------------------------------

export function ConfigJsonTab({ themeId, theme }: ConfigJsonTabProps) {
  const serverText = serialize(theme.config_json);
  const [text, setText] = useState(serverText);
  const [parseError, setParseError] = useState<string | null>(null);

  const updateConfig = useUpdateConfigJson(themeId);

  // Sync local state when server data changes (e.g. after save invalidation)
  useEffect(() => {
    setText(serverText);
    setParseError(null);
  }, [serverText]);

  const isDirty = text !== serverText;

  const handleSave = () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      setParseError("유효하지 않은 JSON 형식입니다");
      return;
    }
    setParseError(null);

    updateConfig.mutate(parsed, {
      onSuccess: () => {
        toast.success("설정이 저장되었습니다");
      },
      onError: () => {
        toast.error("설정 저장에 실패했습니다");
      },
    });
  };

  const handleReset = () => {
    setText(serverText);
    setParseError(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">설정 JSON</h2>
        {isDirty && <Badge variant="warning">변경사항 있음</Badge>}
      </div>

      {/* Textarea */}
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (parseError) setParseError(null);
        }}
        spellCheck={false}
        className="min-h-[400px] w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
      />

      {/* Validation error */}
      {parseError && (
        <p className="text-sm text-red-400">{parseError}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={handleSave}
          isLoading={updateConfig.isPending}
          disabled={!isDirty}
        >
          저장
        </Button>
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={!isDirty || updateConfig.isPending}
        >
          초기화
        </Button>
      </div>
    </div>
  );
}
