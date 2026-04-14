package editor

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/clue"
	"github.com/mmp-platform/server/internal/db"
)

// ClueRelationRequest is the input for a single clue relation.
type ClueRelationRequest struct {
	SourceID uuid.UUID `json:"sourceId"`
	TargetID uuid.UUID `json:"targetId"`
	Mode     string    `json:"mode"` // "AND" or "OR"
}

// ClueRelationResponse is the output for a single clue relation.
type ClueRelationResponse struct {
	ID       uuid.UUID `json:"id"`
	SourceID uuid.UUID `json:"sourceId"`
	TargetID uuid.UUID `json:"targetId"`
	Mode     string    `json:"mode"`
}

func (s *service) GetClueRelations(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueRelationResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	rows, err := s.q.ListClueRelationsByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list clue relations")
		return nil, apperror.Internal("failed to list clue relations")
	}

	return toClueRelationResponses(rows), nil
}

func (s *service) ReplaceClueRelations(ctx context.Context, creatorID, themeID uuid.UUID, reqs []ClueRelationRequest) ([]ClueRelationResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	// Build graph from existing clues to validate cycle.
	clues, err := s.q.ListCluesByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list clues for cycle check")
		return nil, apperror.Internal("failed to list clues")
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

	// Transactional replace.
	var results []ClueRelationResponse
	err = pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
		qtx := s.q.WithTx(tx)
		if err := qtx.DeleteClueRelationsByTheme(ctx, themeID); err != nil {
			return err
		}
		for _, r := range reqs {
			row, err := qtx.InsertClueRelation(ctx, db.InsertClueRelationParams{
				ThemeID:  themeID,
				SourceID: r.SourceID,
				TargetID: r.TargetID,
				Mode:     r.Mode,
			})
			if err != nil {
				return err
			}
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
