import { Plus, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Mission {
  id: string;
  type: string;
  description: string;
  points: number;
}

interface MissionEditorProps {
  missions: Mission[];
  onAdd: () => void;
  onChange: (missionId: string, field: keyof Mission, value: string | number) => void;
  onDelete: (missionId: string) => void;
}

const MISSION_TYPES = [
  { value: 'find', label: '찾기' },
  { value: 'protect', label: '보호' },
  { value: 'sabotage', label: '방해' },
  { value: 'observe', label: '관찰' },
];

// ---------------------------------------------------------------------------
// MissionEditor
// ---------------------------------------------------------------------------

export function MissionEditor({ missions, onAdd, onChange, onDelete }: MissionEditorProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-medium text-slate-400">히든 미션</h4>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
        >
          <Plus className="h-3 w-3" />
          추가
        </button>
      </div>
      {missions.length > 0 ? (
        <div className="space-y-3">
          {missions.map((mission) => (
            <div
              key={mission.id}
              className="rounded border border-slate-800 bg-slate-900 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <select
                  value={mission.type}
                  onChange={(e) => onChange(mission.id, 'type', e.target.value)}
                  className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
                >
                  {MISSION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onDelete(mission.id)}
                  aria-label="미션 삭제"
                  className="text-slate-600 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={mission.description}
                onChange={(e) => onChange(mission.id, 'description', e.target.value)}
                placeholder="미션 설명"
                className="mb-2 w-full rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 placeholder-slate-600"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">포인트:</span>
                <input
                  type="number"
                  value={mission.points}
                  onChange={(e) => onChange(mission.id, 'points', Number(e.target.value))}
                  className="w-16 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-600">미션이 없습니다</p>
      )}
    </div>
  );
}
