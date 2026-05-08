import type { FlowNodeData } from "../../flowTypes";
import { ReadingPlacementPanel } from "./ReadingPlacementPanel";

interface StoryProgressionPanelProps {
  themeId: string;
  phaseData: FlowNodeData;
  onChange: (patch: Partial<FlowNodeData>) => void;
}

export function StoryProgressionPanel({
  themeId,
  phaseData,
  onChange,
}: StoryProgressionPanelProps) {
  return (
    <ReadingPlacementPanel
      themeId={themeId}
      phaseData={phaseData}
      onChange={onChange}
    />
  );
}
