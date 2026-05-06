package editor

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// getOwnedTheme fetches a theme and verifies creator ownership.
func (s *service) getOwnedTheme(ctx context.Context, creatorID, themeID uuid.UUID) (db.Theme, error) {
	theme, err := s.q.GetTheme(ctx, themeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Theme{}, apperror.NotFound("theme not found")
		}
		s.logger.Error().Err(err).Msg("failed to get theme")
		return db.Theme{}, apperror.Internal("failed to get theme")
	}
	if theme.CreatorID != creatorID {
		return db.Theme{}, apperror.Forbidden("you do not own this theme")
	}
	return theme, nil
}

func textToPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

func ptrToText(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func int32PtrToPgtype(i *int32) pgtype.Int4 {
	if i == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: *i, Valid: true}
}

func pgtypeInt4ToPtr(i pgtype.Int4) *int32 {
	if !i.Valid {
		return nil
	}
	v := i.Int32
	return &v
}

var slugCleanRe = regexp.MustCompile(`[^a-z0-9-]+`)
var themeSlugRe = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

func isValidThemeSlug(slug string) bool {
	return themeSlugRe.MatchString(slug)
}

func generateSlug(title string) string {
	s := strings.ToLower(strings.TrimSpace(title))
	s = strings.ReplaceAll(s, " ", "-")
	s = slugCleanRe.ReplaceAllString(s, "")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "theme"
	}

	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		// fallback: use timestamp-based suffix
		return fmt.Sprintf("%s-%d", s, time.Now().UnixMilli()%10000)
	}
	return fmt.Sprintf("%s-%s", s, hex.EncodeToString(b)[:4])
}

// isUniqueViolation returns true if err is a PostgreSQL unique constraint violation (code 23505).
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func toThemeResponse(t db.Theme) *ThemeResponse {
	resp := &ThemeResponse{
		ID:                t.ID,
		Title:             t.Title,
		Slug:              t.Slug,
		Description:       textToPtr(t.Description),
		CoverImage:        textToPtr(t.CoverImage),
		CoverImageMediaID: pgtypeUUIDToPtr(t.CoverImageMediaID),
		MinPlayers:        t.MinPlayers,
		MaxPlayers:        t.MaxPlayers,
		DurationMin:       t.DurationMin,
		Price:             t.Price,
		CoinPrice:         t.CoinPrice,
		Status:            t.Status,
		Version:           t.Version,
		CreatedAt:         t.CreatedAt,
	}
	if len(t.ConfigJson) > 0 && string(t.ConfigJson) != "null" {
		resp.ConfigJson = t.ConfigJson
	}
	if t.ReviewNote.Valid {
		s := t.ReviewNote.String
		resp.ReviewNote = &s
	}
	if t.ReviewedAt.Valid {
		ts := t.ReviewedAt.Time
		resp.ReviewedAt = &ts
	}
	if t.ReviewedBy.Valid {
		id := t.ReviewedBy.Bytes
		uid := uuid.UUID(id)
		resp.ReviewedBy = &uid
	}
	return resp
}
