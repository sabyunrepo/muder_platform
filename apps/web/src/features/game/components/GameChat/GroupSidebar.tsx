import { GroupListView } from "./GroupListView";
import { GroupCreateView } from "./GroupCreateView";
import type { GroupInfo } from "./types";

interface GroupSidebarProps {
  groups: GroupInfo[];
  selectedGroupId: string;
  onSelectGroup: (id: string) => void;
  isCreatingGroup: boolean;
  onStartCreate: () => void;
  onCancelCreate: () => void;
  selectedMembers: string[];
  onToggleMember: (id: string) => void;
  onCreateGroup: () => void;
  otherPlayers: { id: string; nickname: string }[];
}

export function GroupSidebar({
  groups,
  selectedGroupId,
  onSelectGroup,
  isCreatingGroup,
  onStartCreate,
  onCancelCreate,
  selectedMembers,
  onToggleMember,
  onCreateGroup,
  otherPlayers,
}: GroupSidebarProps) {
  return (
    <div className="border-b border-slate-800">
      {!isCreatingGroup ? (
        <GroupListView
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          onStartCreate={onStartCreate}
        />
      ) : (
        <GroupCreateView
          otherPlayers={otherPlayers}
          selectedMembers={selectedMembers}
          onToggleMember={onToggleMember}
          onCancelCreate={onCancelCreate}
          onCreateGroup={onCreateGroup}
        />
      )}
    </div>
  );
}
