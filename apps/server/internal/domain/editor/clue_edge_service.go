package editor

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/clue"
	"github.com/mmp-platform/server/internal/db"
)

// Phase 20 PR-4: unified clue edge service. Replaces clue_relation_service.go.
//
// Edges are modelled as "groups" — each group pairs one target clue with N
// source clues under a (trigger, mode) tuple. A target may have multiple
// groups (e.g. one AUTO + one CRAFT). Cycle detection treats all groups as
// AUTO/AND for the purposes of reachability, so any cyclic reference is
// rejected regardless of trigger/mode.

const (
	maxClueEdgeGroups = 500
	edgeTriggerAUTO   = "AUTO"
	edgeTriggerCRAFT  = "CRAFT"
	edgeModeAND       = "AND"
	edgeModeOR        = "OR"
)

// GetClueEdges returns the saved edge groups for a theme (owned by creator).
func (s *service) GetClueEdges(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueEdgeGroupResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	groups, err := s.q.ListClueEdgeGroupsByTheme(ctx, themeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return []ClueEdgeGroupResponse{}, nil
		}
		s.logger.Error().Err(err).Msg("failed to list clue edge groups")
		return nil, apperror.Internal("failed to list clue edges")
	}

	members, err := s.q.ListClueEdgeMembersByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list clue edge members")
		return nil, apperror.Internal("failed to list clue edges")
	}

	sourcesByGroup := make(map[uuid.UUID][]uuid.UUID, len(groups))
	for _, m := range members {
		sourcesByGroup[m.GroupID] = append(sourcesByGroup[m.GroupID], m.SourceID)
	}

	out := make([]ClueEdgeGroupResponse, 0, len(groups))
	for _, g := range groups {
		sources := sourcesByGroup[g.ID]
		if sources == nil {
			sources = []uuid.UUID{}
		}
		out = append(out, ClueEdgeGroupResponse{
			ID:       g.ID,
			TargetID: g.TargetID,
			Sources:  sources,
			Trigger:  g.Trigger,
			Mode:     g.Mode,
		})
	}
	return out, nil
}

// ReplaceClueEdges validates the input, rejects cycles, and atomically
// replaces the theme's edge groups with the provided set.
func (s *service) ReplaceClueEdges(ctx context.Context, creatorID, themeID uuid.UUID, reqs []ClueEdgeGroupRequest) ([]ClueEdgeGroupResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	if len(reqs) > maxClueEdgeGroups {
		return nil, apperror.BadRequest(fmt.Sprintf("too many edge groups (max %d)", maxClueEdgeGroups))
	}

	clues, err := s.q.ListCluesByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list clues")
		return nil, apperror.Internal("failed to list clues")
	}
	ownedIDs := make(map[uuid.UUID]struct{}, len(clues))
	for _, c := range clues {
		ownedIDs[c.ID] = struct{}{}
	}

	if err := validateEdgeGroupRequests(reqs, ownedIDs); err != nil {
		return nil, err
	}
	if err := detectEdgeCycle(reqs, clues); err != nil {
		return nil, err
	}

	results, err := s.persistClueEdges(ctx, themeID, reqs)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to replace clue edges")
		return nil, apperror.Internal("failed to replace clue edges")
	}
	if results == nil {
		results = []ClueEdgeGroupResponse{}
	}
	return results, nil
}

// validateEdgeGroupRequests runs all payload-only checks: trigger/mode values,
// source/target ownership, duplicate members, CRAFT+OR rejection.
func validateEdgeGroupRequests(reqs []ClueEdgeGroupRequest, ownedIDs map[uuid.UUID]struct{}) error {
	for i, r := range reqs {
		if _, ok := ownedIDs[r.TargetID]; !ok {
			return apperror.BadRequest(fmt.Sprintf("edge[%d]: targetId does not belong to this theme", i))
		}
		if len(r.Sources) == 0 {
			return apperror.BadRequest(fmt.Sprintf("edge[%d]: sources must be non-empty", i))
		}
		seen := make(map[uuid.UUID]struct{}, len(r.Sources))
		for _, src := range r.Sources {
			if _, ok := ownedIDs[src]; !ok {
				return apperror.BadRequest(fmt.Sprintf("edge[%d]: source does not belong to this theme", i))
			}
			if src == r.TargetID {
				return apperror.BadRequest(fmt.Sprintf("edge[%d]: source cannot equal target", i))
			}
			if _, dup := seen[src]; dup {
				return apperror.BadRequest(fmt.Sprintf("edge[%d]: duplicate source", i))
			}
			seen[src] = struct{}{}
		}
		if r.Trigger != edgeTriggerAUTO && r.Trigger != edgeTriggerCRAFT {
			return apperror.BadRequest(fmt.Sprintf("edge[%d]: trigger must be AUTO or CRAFT", i))
		}
		if r.Mode != edgeModeAND && r.Mode != edgeModeOR {
			return apperror.BadRequest(fmt.Sprintf("edge[%d]: mode must be AND or OR", i))
		}
		if r.Trigger == edgeTriggerCRAFT && r.Mode == edgeModeOR {
			return apperror.New("EDGE_INVALID_CRAFT_OR", 400,
				fmt.Sprintf("edge[%d]: CRAFT trigger does not allow OR mode", i))
		}
	}
	return nil
}

// detectEdgeCycle builds a cycle-check graph where every source→target edge
// counts regardless of trigger/mode. Any SCC with >1 node means the input is
// unreachable.
func detectEdgeCycle(reqs []ClueEdgeGroupRequest, clues []db.ThemeClue) error {
	g := clue.NewGraph()
	for _, c := range clues {
		_ = g.Add(clue.Clue{ID: clue.ClueID(c.ID.String()), Name: c.Name})
	}

	// Aggregate all sources per target under one synthetic AUTO/AND dep —
	// Graph.AddDependency rejects duplicate deps per target, so we build the
	// union up-front.
	aggregated := make(map[uuid.UUID]map[uuid.UUID]struct{})
	for _, r := range reqs {
		if _, ok := aggregated[r.TargetID]; !ok {
			aggregated[r.TargetID] = make(map[uuid.UUID]struct{})
		}
		for _, src := range r.Sources {
			aggregated[r.TargetID][src] = struct{}{}
		}
	}

	for targetID, sourceSet := range aggregated {
		prereqs := make([]clue.ClueID, 0, len(sourceSet))
		for src := range sourceSet {
			prereqs = append(prereqs, clue.ClueID(src.String()))
		}
		if err := g.AddDependency(clue.Dependency{
			ClueID:        clue.ClueID(targetID.String()),
			Prerequisites: prereqs,
			Mode:          clue.ModeAND,
			Trigger:       clue.TriggerAUTO,
		}); err != nil {
			return apperror.BadRequest("invalid edge: " + err.Error())
		}
	}
	if g.HasCycle() {
		return apperror.New("EDGE_CYCLE_DETECTED", 400, "clue edge graph contains a cycle")
	}
	return nil
}

// persistClueEdges runs the delete-then-insert atomically inside a pgx tx.
// Returns the new rows as responses so callers can avoid an extra SELECT.
func (s *service) persistClueEdges(ctx context.Context, themeID uuid.UUID, reqs []ClueEdgeGroupRequest) ([]ClueEdgeGroupResponse, error) {
	var results []ClueEdgeGroupResponse
	err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		qtx := s.q.WithTx(tx)
		if err := qtx.DeleteClueEdgeGroupsByTheme(ctx, themeID); err != nil {
			return err
		}
		for _, r := range reqs {
			group, err := qtx.InsertClueEdgeGroup(ctx, db.InsertClueEdgeGroupParams{
				ThemeID:  themeID,
				TargetID: r.TargetID,
				Trigger:  r.Trigger,
				Mode:     r.Mode,
			})
			if err != nil {
				return err
			}
			groupIDs := make([]uuid.UUID, len(r.Sources))
			sourceIDs := make([]uuid.UUID, len(r.Sources))
			for i, src := range r.Sources {
				groupIDs[i] = group.ID
				sourceIDs[i] = src
			}
			if _, err := qtx.BulkInsertClueEdgeMembers(ctx, db.BulkInsertClueEdgeMembersParams{
				GroupIds:  groupIDs,
				SourceIds: sourceIDs,
			}); err != nil {
				return err
			}
			results = append(results, ClueEdgeGroupResponse{
				ID:       group.ID,
				TargetID: group.TargetID,
				Sources:  r.Sources,
				Trigger:  group.Trigger,
				Mode:     group.Mode,
			})
		}
		return nil
	})
	return results, err
}
