import type { FlowNodeData } from "../../flowTypes";
import { PhaseDurationField } from "./PhaseDurationField";

interface InvestigationPhasePanelProps {
  duration: number | undefined;
  onChange: (patch: Partial<FlowNodeData>) => void;
  onFlush: () => void;
}

export function InvestigationPhasePanel({
  duration,
  onChange,
  onFlush,
}: InvestigationPhasePanelProps) {
  return (
    <>
      <PhaseDurationField
        duration={duration}
        onChange={onChange}
        onFlush={onFlush}
      />
      <p className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
        수사 시간이 끝나면 다음 연결 장면으로 자동 진행됩니다.
      </p>
    </>
  );
}
