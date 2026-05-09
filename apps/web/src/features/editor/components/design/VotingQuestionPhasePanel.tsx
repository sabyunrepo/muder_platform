import type { FlowNodeData } from "../../flowTypes";
import { PhaseDurationField } from "./PhaseDurationField";

interface VotingQuestionPhasePanelProps {
  duration: number | undefined;
  onChange: (patch: Partial<FlowNodeData>) => void;
  onFlush: () => void;
}

export function VotingQuestionPhasePanel({
  duration,
  onChange,
  onFlush,
}: VotingQuestionPhasePanelProps) {
  return (
    <PhaseDurationField
      duration={duration}
      onChange={onChange}
      onFlush={onFlush}
    />
  );
}
