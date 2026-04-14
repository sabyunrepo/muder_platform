import { FlowCanvas } from './FlowCanvas';

interface FlowSubTabProps {
  themeId: string;
}

export function FlowSubTab({ themeId }: FlowSubTabProps) {
  return <FlowCanvas themeId={themeId} />;
}
