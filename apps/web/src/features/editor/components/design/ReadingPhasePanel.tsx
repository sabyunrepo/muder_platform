import type { FlowNodeData } from "../../flowTypes";
import { ReadingPlacementPanel } from "./ReadingPlacementPanel";

interface ReadingPhasePanelProps {
  themeId: string;
  phaseData: FlowNodeData;
  onChange: (patch: Partial<FlowNodeData>) => void;
}

export function ReadingPhasePanel({
  themeId,
  phaseData,
  onChange,
}: ReadingPhasePanelProps) {
  return (
    <ReadingPlacementPanel
      themeId={themeId}
      phaseData={phaseData}
      onChange={onChange}
    />
  );
}
