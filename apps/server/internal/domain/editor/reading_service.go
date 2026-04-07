package editor

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// readingQueries is the subset of db.Queries that ReadingService depends on.
// Defined as an interface so unit tests can substitute a fake implementation
// without spinning up Postgres.
type readingQueries interface {
	GetTheme(ctx context.Context, id uuid.UUID) (db.Theme, error)
	GetMedia(ctx context.Context, id uuid.UUID) (db.ThemeMedium, error)
	ListReadingSectionsByTheme(ctx context.Context, themeID uuid.UUID) ([]db.ReadingSection, error)
	GetReadingSectionWithOwner(ctx context.Context, arg db.GetReadingSectionWithOwnerParams) (db.ReadingSection, error)
	CreateReadingSection(ctx context.Context, arg db.CreateReadingSectionParams) (db.ReadingSection, error)
	UpdateReadingSection(ctx context.Context, arg db.UpdateReadingSectionParams) (db.ReadingSection, error)
	DeleteReadingSectionWithOwner(ctx context.Context, arg db.DeleteReadingSectionWithOwnerParams) (int64, error)
}

// ReadingService manages reading section CRUD for the editor.
type ReadingService interface {
	List(ctx context.Context, creatorID, themeID uuid.UUID) ([]ReadingSectionResponse, error)
	Create(ctx context.Context, creatorID, themeID uuid.UUID, req CreateReadingSectionRequest) (*ReadingSectionResponse, error)
	Update(ctx context.Context, creatorID, sectionID uuid.UUID, req UpdateReadingSectionRequest) (*ReadingSectionResponse, error)
	Delete(ctx context.Context, creatorID, sectionID uuid.UUID) error
}

type readingService struct {
	q      readingQueries
	logger zerolog.Logger
}

// NewReadingService constructs a ReadingService backed by the given queries.
func NewReadingService(q *db.Queries, logger zerolog.Logger) ReadingService {
	return newReadingServiceWith(q, logger)
}

// newReadingServiceWith is the test-friendly constructor that accepts the
// narrower readingQueries interface so a fake can be injected.
func newReadingServiceWith(q readingQueries, logger zerolog.Logger) *readingService {
	return &readingService{
		q:      q,
		logger: logger.With().Str("domain", "editor.reading").Logger(),
	}
}

// --- ownership / lookup helpers ---

func (s *readingService) ownedTheme(ctx context.Context, creatorID, themeID uuid.UUID) (db.Theme, error) {
	theme, err := s.q.GetTheme(ctx, themeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Theme{}, apperror.NotFound("theme not found")
		}
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to get theme")
		return db.Theme{}, apperror.Internal("failed to get theme")
	}
	if theme.CreatorID != creatorID {
		return db.Theme{}, apperror.NotFound("theme not found")
	}
	return theme, nil
}

func (s *readingService) ownedSection(ctx context.Context, creatorID, sectionID uuid.UUID) (db.ReadingSection, error) {
	section, err := s.q.GetReadingSectionWithOwner(ctx, db.GetReadingSectionWithOwnerParams{
		ID:        sectionID,
		CreatorID: creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.ReadingSection{}, apperror.New(apperror.ErrReadingSectionNotFound, 404, "reading section not found")
		}
		s.logger.Error().Err(err).Str("section_id", sectionID.String()).Msg("failed to get reading section")
		return db.ReadingSection{}, apperror.Internal("failed to get reading section")
	}
	return section, nil
}

// --- validation ---

// validateAdvanceBy reports whether s is a valid advanceBy token. Empty
// string is allowed and means "inherit from default".
func validateAdvanceBy(s string) bool {
	switch s {
	case "", AdvanceByVoice, AdvanceByGM:
		return true
	}
	if strings.HasPrefix(s, AdvanceByRolePfx) && len(s) > len(AdvanceByRolePfx) {
		return true
	}
	return false
}

// validateLines applies per-line invariants and cross-checks every referenced
// media ID against the same theme.
func (s *readingService) validateLines(ctx context.Context, themeID uuid.UUID, lines []ReadingLineDTO) error {
	if len(lines) > MaxReadingLinesPerSection {
		return apperror.New(apperror.ErrValidation, 422, "too many lines in section")
	}
	for i, ln := range lines {
		if !validateAdvanceBy(ln.AdvanceBy) {
			return apperror.New(apperror.ErrReadingInvalidAdvanceBy, 400, "line "+itoa(i)+": invalid advanceBy")
		}
		if ln.AdvanceBy == AdvanceByVoice && ln.VoiceMediaID == "" {
			return apperror.New(apperror.ErrReadingVoiceRequired, 400, "line "+itoa(i)+": voice mode requires voiceMediaId")
		}
		if ln.VoiceMediaID != "" {
			mediaID, err := uuid.Parse(ln.VoiceMediaID)
			if err != nil {
				return apperror.New(apperror.ErrMediaNotInTheme, 400, "line "+itoa(i)+": invalid voiceMediaId")
			}
			if err := s.assertMediaInTheme(ctx, themeID, mediaID, MediaTypeVoice); err != nil {
				return err
			}
		}
	}
	return nil
}

// assertMediaInTheme verifies that mediaID exists and belongs to themeID.
// If wantType is non-empty, the media's type must also match.
func (s *readingService) assertMediaInTheme(ctx context.Context, themeID, mediaID uuid.UUID, wantType string) error {
	media, err := s.q.GetMedia(ctx, mediaID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.New(apperror.ErrMediaNotInTheme, 400, "media not found")
		}
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to get media")
		return apperror.Internal("failed to verify media reference")
	}
	if media.ThemeID != themeID {
		return apperror.New(apperror.ErrMediaNotInTheme, 400, "media does not belong to this theme")
	}
	if wantType != "" && media.Type != wantType {
		return apperror.New(apperror.ErrMediaNotInTheme, 400, "media has wrong type for this slot")
	}
	return nil
}

// --- List ---

func (s *readingService) List(ctx context.Context, creatorID, themeID uuid.UUID) ([]ReadingSectionResponse, error) {
	if _, err := s.ownedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListReadingSectionsByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to list reading sections")
		return nil, apperror.Internal("failed to list reading sections")
	}
	out := make([]ReadingSectionResponse, 0, len(rows))
	for _, r := range rows {
		resp, convErr := toReadingSectionResponse(r)
		if convErr != nil {
			s.logger.Error().Err(convErr).Str("section_id", r.ID.String()).Msg("failed to decode reading section lines")
			return nil, apperror.Internal("corrupted reading section data")
		}
		out = append(out, *resp)
	}
	return out, nil
}

// --- Create ---

func (s *readingService) Create(ctx context.Context, creatorID, themeID uuid.UUID, req CreateReadingSectionRequest) (*ReadingSectionResponse, error) {
	if _, err := s.ownedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	if req.Lines == nil {
		req.Lines = []ReadingLineDTO{}
	}
	normalizeLineIndices(req.Lines)

	if err := s.validateLines(ctx, themeID, req.Lines); err != nil {
		return nil, err
	}

	bgmParam, err := s.resolveBgmMediaID(ctx, themeID, req.BgmMediaID)
	if err != nil {
		return nil, err
	}

	linesJSON, err := json.Marshal(req.Lines)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to marshal reading lines")
		return nil, apperror.Internal("failed to encode reading lines")
	}

	row, err := s.q.CreateReadingSection(ctx, db.CreateReadingSectionParams{
		ThemeID:    themeID,
		Name:       req.Name,
		BgmMediaID: bgmParam,
		Lines:      linesJSON,
		SortOrder:  req.SortOrder,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to create reading section")
		return nil, apperror.Internal("failed to create reading section")
	}
	return toReadingSectionResponse(row)
}

// --- Update ---

func (s *readingService) Update(ctx context.Context, creatorID, sectionID uuid.UUID, req UpdateReadingSectionRequest) (*ReadingSectionResponse, error) {
	current, err := s.ownedSection(ctx, creatorID, sectionID)
	if err != nil {
		return nil, err
	}

	// Resolve target field values from current + patch.
	name := current.Name
	if req.Name != nil {
		name = *req.Name
	}

	sortOrder := current.SortOrder
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	// Lines: if patch supplies new lines, validate them; otherwise keep current.
	var linesJSON []byte
	if req.Lines != nil {
		lines := *req.Lines
		if lines == nil {
			lines = []ReadingLineDTO{}
		}
		normalizeLineIndices(lines)
		if err := s.validateLines(ctx, current.ThemeID, lines); err != nil {
			return nil, err
		}
		linesJSON, err = json.Marshal(lines)
		if err != nil {
			s.logger.Error().Err(err).Msg("failed to marshal reading lines")
			return nil, apperror.Internal("failed to encode reading lines")
		}
	} else {
		linesJSON = []byte(current.Lines)
	}

	// BgmMediaID: pointer-to-pointer encoding.
	var bgmParam pgtype.UUID
	switch {
	case req.BgmMediaID == nil:
		// not present in patch — keep current value
		bgmParam = current.BgmMediaID
	case *req.BgmMediaID == nil:
		// explicitly set to null
		bgmParam = pgtype.UUID{}
	default:
		resolved, err := s.resolveBgmMediaID(ctx, current.ThemeID, *req.BgmMediaID)
		if err != nil {
			return nil, err
		}
		bgmParam = resolved
	}

	row, err := s.q.UpdateReadingSection(ctx, db.UpdateReadingSectionParams{
		ID:         sectionID,
		Name:       name,
		BgmMediaID: bgmParam,
		Lines:      linesJSON,
		SortOrder:  sortOrder,
		Version:    req.Version,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrConflict, 409, "version mismatch")
		}
		s.logger.Error().Err(err).Str("section_id", sectionID.String()).Msg("failed to update reading section")
		return nil, apperror.Internal("failed to update reading section")
	}
	return toReadingSectionResponse(row)
}

// --- Delete ---

func (s *readingService) Delete(ctx context.Context, creatorID, sectionID uuid.UUID) error {
	rows, err := s.q.DeleteReadingSectionWithOwner(ctx, db.DeleteReadingSectionWithOwnerParams{
		ID:        sectionID,
		CreatorID: creatorID,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("section_id", sectionID.String()).Msg("failed to delete reading section")
		return apperror.Internal("failed to delete reading section")
	}
	if rows == 0 {
		return apperror.New(apperror.ErrReadingSectionNotFound, 404, "reading section not found")
	}
	return nil
}

// --- helpers ---

// resolveBgmMediaID validates a *string BGM reference (used by Create and the
// "set" branch of Update) and returns the corresponding pgtype.UUID.
// nil pointer or empty string both yield a NULL pgtype.UUID.
func (s *readingService) resolveBgmMediaID(ctx context.Context, themeID uuid.UUID, raw *string) (pgtype.UUID, error) {
	if raw == nil || *raw == "" {
		return pgtype.UUID{}, nil
	}
	mediaID, err := uuid.Parse(*raw)
	if err != nil {
		return pgtype.UUID{}, apperror.New(apperror.ErrMediaNotInTheme, 400, "invalid bgmMediaId")
	}
	if err := s.assertMediaInTheme(ctx, themeID, mediaID, MediaTypeBGM); err != nil {
		return pgtype.UUID{}, err
	}
	return pgtype.UUID{Bytes: mediaID, Valid: true}, nil
}

// normalizeLineIndices rewrites line.Index to match its position in the slice
// so the editor doesn't need to keep them in sync manually.
func normalizeLineIndices(lines []ReadingLineDTO) {
	for i := range lines {
		lines[i].Index = i
	}
}

func toReadingSectionResponse(r db.ReadingSection) (*ReadingSectionResponse, error) {
	lines := []ReadingLineDTO{}
	if len(r.Lines) > 0 {
		if err := json.Unmarshal(r.Lines, &lines); err != nil {
			return nil, err
		}
	}
	resp := &ReadingSectionResponse{
		ID:        r.ID,
		ThemeID:   r.ThemeID,
		Name:      r.Name,
		Lines:     lines,
		SortOrder: r.SortOrder,
		Version:   r.Version,
		CreatedAt: r.CreatedAt,
		UpdatedAt: r.UpdatedAt,
	}
	if r.BgmMediaID.Valid {
		id := uuid.UUID(r.BgmMediaID.Bytes).String()
		resp.BgmMediaID = &id
	}
	return resp, nil
}

// itoa is a tiny strconv.Itoa replacement to avoid an import for one call site.
func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	neg := i < 0
	if neg {
		i = -i
	}
	var buf [20]byte
	pos := len(buf)
	for i > 0 {
		pos--
		buf[pos] = byte('0' + i%10)
		i /= 10
	}
	if neg {
		pos--
		buf[pos] = '-'
	}
	return string(buf[pos:])
}
