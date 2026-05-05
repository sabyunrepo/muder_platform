import type { DiscussionRoomAvailability, DiscussionRoomPolicy } from "../../flowTypes";
import {
  normalizeDiscussionRoomPolicy,
  patchDiscussionRoomPolicy,
} from "../../entities/phase/discussionRoomPolicyAdapter";

interface DiscussionRoomPolicyPanelProps {
  policy: DiscussionRoomPolicy | undefined;
  onChange: (policy: DiscussionRoomPolicy) => void;
}

export function DiscussionRoomPolicyPanel({ policy, onChange }: DiscussionRoomPolicyPanelProps) {
  const normalized = normalizeDiscussionRoomPolicy(policy);

  const update = (patch: Partial<DiscussionRoomPolicy>) => {
    onChange(patchDiscussionRoomPolicy(normalized, patch));
  };

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-amber-400"
            checked={normalized.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
          />
          <span>
            <span className="block text-sm font-semibold text-slate-100">토론방</span>
            <span className="block text-xs leading-5 text-slate-500">
              이 장면에서 플레이어가 모여 대화할 공간을 정합니다.
            </span>
          </span>
        </label>

        {normalized.enabled && (
          <div className="grid gap-3">
            <LabeledTextInput
              label="메인 토론방"
              value={normalized.mainRoomName}
              placeholder="전체 토론"
              onChange={(mainRoomName) => update({ mainRoomName })}
            />

            <label className="flex items-start gap-3 rounded border border-slate-800 bg-slate-900/40 px-3 py-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-amber-400"
                checked={normalized.privateRoomsEnabled}
                onChange={(event) => update({ privateRoomsEnabled: event.target.checked })}
              />
              <span>
                <span className="block text-xs font-semibold text-slate-200">밀담방 허용</span>
                <span className="block text-xs leading-5 text-slate-500">
                  소수 인원이 따로 이야기할 수 있는 방을 함께 엽니다.
                </span>
              </span>
            </label>

            {normalized.privateRoomsEnabled && (
              <LabeledTextInput
                label="밀담방 이름"
                value={normalized.privateRoomName}
                placeholder="밀담방"
                onChange={(privateRoomName) => update({ privateRoomName })}
              />
            )}

            <label className="grid gap-1 text-xs text-slate-400">
              <span className="font-medium text-slate-300">이용 가능 시점</span>
              <select
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={normalized.availability}
                onChange={(event) =>
                  update({ availability: event.target.value as DiscussionRoomAvailability })
                }
              >
                <option value="phase_active">장면 시작 시 바로 열기</option>
                <option value="condition">트리거가 열 때까지 대기</option>
              </select>
            </label>

            {normalized.availability === "condition" && (
              <LabeledTextInput
                label="조건부 방명"
                value={normalized.conditionalRoomName ?? ""}
                placeholder="비밀 토론"
                onChange={(conditionalRoomName) => update({ conditionalRoomName })}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function LabeledTextInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-slate-400">
      <span className="font-medium text-slate-300">{label}</span>
      <input
        className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
