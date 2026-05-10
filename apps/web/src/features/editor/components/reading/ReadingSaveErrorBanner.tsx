import { AlertCircle } from 'lucide-react';

import type { ReadingSaveValidationIssue } from './readingSectionEditorModel';

export function ReadingSaveErrorBanner({
  message,
  issues,
}: {
  message: string;
  issues: ReadingSaveValidationIssue[];
}) {
  return (
    <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">{message}</p>
          {issues.length > 0 ? (
            <ul className="space-y-0.5 text-rose-200">
              {issues.map((issue) => (
                <li key={`${issue.lineIndex}-${issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
