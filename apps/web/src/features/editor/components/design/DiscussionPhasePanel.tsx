import type { DiscussionPrivateRoomPolicy, DiscussionRoomPolicy, FlowNodeData } from "../../flowTypes";
import {
  normalizeDiscussionRoomPolicy,
  patchDiscussionRoomPolicy,
} from "../../entities/phase/discussionRoomPolicyAdapter";
import { PhaseDurationField } from "./PhaseDurationField";

interface DiscussionPhasePanelProps {
  duration: number | undefined;
  policy: DiscussionRoomPolicy | undefined;
  onChange: (patch: Partial<FlowNodeData>) => void;
  onFlush: () => void;
}

const INPUT_CLASS =
  "rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60";

export function DiscussionPhasePanel({
  duration,
  policy,
  onChange,
  onFlush,
}: DiscussionPhasePanelProps) {
  const normalized = normalizeDiscussionRoomPolicy({ ...policy, enabled: true });

  const updatePolicy = (patch: Partial<DiscussionRoomPolicy>) => {
    onChange({ discussionRoomPolicy: patchDiscussionRoomPolicy(normalized, patch) });
  };

  const updatePrivateRoom = (
    roomId: string,
    updater: (room: DiscussionPrivateRoomPolicy) => DiscussionPrivateRoomPolicy,
  ) => {
    updatePolicy({
      privateRooms: normalized.privateRooms.map((room) =>
        room.id === roomId ? updater(room) : room,
      ),
    });
  };

  const addPrivateRoom = () => {
    const roomNumber = nextPrivateRoomNumber(normalized.privateRooms);
    updatePolicy({
      privateRooms: [
        ...normalized.privateRooms,
        {
          id: `private-${roomNumber}`,
          name: `밀담방 ${roomNumber}`,
          maxMembers: 2,
          timeLimitSeconds: null,
        },
      ],
    });
  };

  const removePrivateRoom = (roomId: string) => {
    updatePolicy({
      privateRooms: normalized.privateRooms.filter((room) => room.id !== roomId),
    });
  };

  return (
    <>
      <PhaseDurationField
        duration={duration}
        onChange={onChange}
        onFlush={onFlush}
      />

      <section
        data-testid="discussion-phase-panel"
        className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
      >
        <div>
          <h4 className="text-sm font-semibold text-slate-100">토론방 설정</h4>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            전체토론방과 밀담방 이름, 인원수, 제한시간을 정합니다.
          </p>
        </div>

        <div className="mt-3 grid gap-3">
          <LabeledInput
            label="전체토론방 이름"
            value={normalized.mainRoomName}
            placeholder="전체토론방"
            onChange={(mainRoomName) => updatePolicy({ mainRoomName })}
          />

          <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
            <div>
              <p className="text-xs font-semibold text-slate-200">밀담방</p>
              <p className="mt-1 text-xs text-slate-400">비워두면 전체토론방만 열립니다.</p>
            </div>
            <button
              type="button"
              onClick={addPrivateRoom}
              className="rounded border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/10"
            >
              밀담방 추가
            </button>
          </div>

          {normalized.privateRooms.length === 0 ? (
            <p className="rounded border border-dashed border-slate-800 px-3 py-3 text-xs text-slate-500">
              등록된 밀담방이 없습니다.
            </p>
          ) : (
            <div className="grid gap-2">
              {normalized.privateRooms.map((room, index) => (
                <PrivateRoomCard
                  key={room.id}
                  room={room}
                  index={index}
                  onChange={(updater) => updatePrivateRoom(room.id, updater)}
                  onRemove={() => removePrivateRoom(room.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function nextPrivateRoomNumber(rooms: DiscussionPrivateRoomPolicy[]) {
  const usedNumbers = new Set(
    rooms
      .map((room) => /^private-(\d+)$/.exec(room.id)?.[1])
      .filter((value): value is string => value != null)
      .map((value) => Number(value)),
  );
  let nextNumber = rooms.length + 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber += 1;
  }
  return nextNumber;
}

function PrivateRoomCard({
  room,
  index,
  onChange,
  onRemove,
}: {
  room: DiscussionPrivateRoomPolicy;
  index: number;
  onChange: (updater: (room: DiscussionPrivateRoomPolicy) => DiscussionPrivateRoomPolicy) => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-300">밀담방 {index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-rose-400/60 hover:text-rose-100"
        >
          삭제
        </button>
      </div>
      <div className="mt-3 grid gap-3">
        <LabeledInput
          label={`밀담방 ${index + 1} 이름`}
          value={room.name}
          placeholder={`밀담방 ${index + 1}`}
          onChange={(name) => onChange((current) => ({ ...current, name }))}
        />
        <label className="grid gap-1 text-xs text-slate-400">
          <span className="font-medium text-slate-300">최대 인원</span>
          <input
            type="number"
            min={2}
            value={room.maxMembers}
            onChange={(event) => {
              const maxMembers = Math.max(2, Number(event.target.value) || 2);
              onChange((current) => ({ ...current, maxMembers }));
            }}
            className={INPUT_CLASS}
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-400">
          <span className="font-medium text-slate-300">제한시간 (분)</span>
          <input
            type="number"
            min={1}
            value={room.timeLimitSeconds == null ? "" : Math.floor(room.timeLimitSeconds / 60)}
            placeholder="무제한"
            onChange={(event) => {
              const timeLimitSeconds = event.target.value ? Number(event.target.value) * 60 : null;
              onChange((current) => ({ ...current, timeLimitSeconds }));
            }}
            className={INPUT_CLASS}
          />
        </label>
      </div>
    </article>
  );
}

function LabeledInput({
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
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
    </label>
  );
}
