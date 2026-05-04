import { Award, CheckCircle2, Scale, Vote } from "lucide-react";

import { Badge, Card } from "@/shared/components/ui";
import { useGameSessionStore as useGameStore } from "@/stores/gameSessionStore";
import { selectPlayers } from "@/stores/gameSelectors";
import { useModuleStore } from "@/stores/moduleStoreFactory";
import {
  buildResultBreakdownViewModel,
  readEndingBranchResult,
  readVoteBreakdown,
} from "../utils/resultBreakdownAdapter";

export function ResultBreakdownPanel() {
  const players = useGameStore(selectPlayers);
  const votingData = useModuleStore("voting", (s) => s.data);
  const endingData = useModuleStore("ending_branch", (s) => s.data);
  const viewModel = buildResultBreakdownViewModel({
    players,
    vote: readVoteBreakdown(votingData),
    ending: readEndingBranchResult(endingData),
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            <h1 className="text-xl font-bold text-slate-100">{viewModel.endingTitle}</h1>
          </div>
          {viewModel.myScoreLabel && <Badge variant="success">{viewModel.myScoreLabel}</Badge>}
        </div>
        <p className="text-sm leading-6 text-slate-400">{viewModel.endingReason}</p>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Vote className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-slate-100">{viewModel.voteTitle}</h2>
        </div>
        <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
          {viewModel.voteSummary}
        </p>

        {viewModel.voteMeta.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {viewModel.voteMeta.map((item) => (
              <Badge key={item} variant="default">{item}</Badge>
            ))}
          </div>
        )}

        {viewModel.voteItems.length > 0 ? (
          <div className="space-y-2">
            {viewModel.voteItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  {item.isWinner ? (
                    <CheckCircle2 className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Scale className="h-4 w-4 text-slate-500" />
                  )}
                  <span className="font-medium text-slate-100">{item.label}</span>
                  {item.isTieCandidate && <Badge variant="warning">동률</Badge>}
                </div>
                <span className="text-sm font-semibold text-amber-300">{item.votes}표</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">표시할 투표 항목이 아직 없어요.</p>
        )}
      </Card>
    </div>
  );
}
