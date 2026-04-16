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

const maxClueRelations = 500

func (s *service) GetClueRelations(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueRelationResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	rows, err := s.q.ListClueRelationsByTheme(ctx, themeID)
	if err != nil {
		// Defensive: sqlc's :many returns an empty slice on no rows, but guard
		// against any lower-layer driver variance that might surface
		// pgx.ErrNoRows. An empty relation set is a normal state for a new
		// theme, not a 500 condition.
		if errors.Is(err, pgx.ErrNoRows) {
			return []ClueRelationResponse{}, nil
		}
		s.logger.Error().Err(err).Msg("failed to list clue relations")
		return nil, apperror.Internal("failed to list clue relations")
	}

	return toClueRelationResponses(rows), nil
}

func (s *service) ReplaceClueRelations(ctx context.Context, creatorID, themeID uuid.UUID, reqs []ClueRelationRequest) ([]ClueRelationResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	// Build owned ID set from existing clues.
	clues, err := s.q.ListCluesByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list clues for cycle check")
		return nil, apperror.Internal("failed to list clues")
	}

	// H-3: request count cap.
	if len(reqs) > maxClueRelations {
		return nil, apperror.BadRequest(fmt.Sprintf("too many relations (max %d)", maxClueRelations))
	}

	// H-1: build owned ID set and validate each request.
	ownedIDs := make(map[uuid.UUID]struct{}, len(clues))
	for _, c := range clues {
		ownedIDs[c.ID] = struct{}{}
	}
	for i, r := range reqs {
		if r.SourceID == r.TargetID {
			return nil, apperror.BadRequest(fmt.Sprintf("relation[%d]: sourceId and targetId must differ", i))
		}
		if _, ok := ownedIDs[r.SourceID]; !ok {
			return nil, apperror.BadRequest(fmt.Sprintf("relation[%d]: sourceId does not belong to this theme", i))
		}
		if _, ok := ownedIDs[r.TargetID]; !ok {
			return nil, apperror.BadRequest(fmt.Sprintf("relation[%d]: targetId does not belong to this theme", i))
		}
		if r.Mode != "AND" && r.Mode != "OR" {
			return nil, apperror.BadRequest(fmt.Sprintf("relation[%d]: mode must be AND or OR, got %q", i, r.Mode))
		}
	}

	g := clue.NewGraph()
	for _, c := range clues {
		_ = g.Add(clue.Clue{ID: clue.ClueID(c.ID.String()), Name: c.Name})
	}

	// Group relations by target (TargetID has prerequisites from SourceIDs).
	prereqMap := make(map[uuid.UUID][]clue.ClueID)
	modeMap := make(map[uuid.UUID]string)
	for _, r := range reqs {
		prereqMap[r.TargetID] = append(prereqMap[r.TargetID], clue.ClueID(r.SourceID.String()))
		modeMap[r.TargetID] = r.Mode
	}

	for targetID, prereqs := range prereqMap {
		mode := clue.ModeAND
		if modeMap[targetID] == "OR" {
			mode = clue.ModeOR
		}
		if err := g.AddDependency(clue.Dependency{
			ClueID:        clue.ClueID(targetID.String()),
			Prerequisites: prereqs,
			Mode:          mode,
		}); err != nil {
			return nil, apperror.BadRequest("invalid relation: " + err.Error())
		}
	}

	if g.HasCycle() {
		return nil, apperror.New("CYCLE_DETECTED", 400, "clue relation graph contains a cycle")
	}

	// H-2: transactional bulk replace.
	var results []ClueRelationResponse
	err = pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		qtx := s.q.WithTx(tx)
		if err := qtx.DeleteClueRelationsByTheme(ctx, themeID); err != nil {
			return err
		}
		if len(reqs) == 0 {
			return nil
		}
		sources := make([]uuid.UUID, len(reqs))
		targets := make([]uuid.UUID, len(reqs))
		modes := make([]string, len(reqs))
		for i, r := range reqs {
			sources[i] = r.SourceID
			targets[i] = r.TargetID
			modes[i] = r.Mode
		}
		rows, err := qtx.BulkInsertClueRelations(ctx, db.BulkInsertClueRelationsParams{
			Column1: themeID,
			Column2: sources,
			Column3: targets,
			Column4: modes,
		})
		if err != nil {
			return err
		}
		for _, row := range rows {
			results = append(results, ClueRelationResponse{
				ID:       row.ID,
				SourceID: row.SourceID,
				TargetID: row.TargetID,
				Mode:     row.Mode,
			})
		}
		return nil
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to replace clue relations")
		return nil, apperror.Internal("failed to replace clue relations")
	}

	if results == nil {
		results = []ClueRelationResponse{}
	}
	return results, nil
}

func toClueRelationResponses(rows []db.ClueRelation) []ClueRelationResponse {
	out := make([]ClueRelationResponse, len(rows))
	for i, r := range rows {
		out[i] = ClueRelationResponse{
			ID:       r.ID,
			SourceID: r.SourceID,
			TargetID: r.TargetID,
			Mode:     r.Mode,
		}
	}
	return out
}
