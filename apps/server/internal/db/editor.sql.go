package db

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// ============================================================
// Maps
// ============================================================

const listMapsByTheme = `-- name: ListMapsByTheme :many
SELECT id, theme_id, name, image_url, sort_order, created_at FROM theme_maps WHERE theme_id = $1 ORDER BY sort_order`

func (q *Queries) ListMapsByTheme(ctx context.Context, themeID uuid.UUID) ([]ThemeMap, error) {
	rows, err := q.db.Query(ctx, listMapsByTheme, themeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ThemeMap{}
	for rows.Next() {
		var i ThemeMap
		if err := rows.Scan(
			&i.ID,
			&i.ThemeID,
			&i.Name,
			&i.ImageUrl,
			&i.SortOrder,
			&i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const getMap = `-- name: GetMap :one
SELECT id, theme_id, name, image_url, sort_order, created_at FROM theme_maps WHERE id = $1`

func (q *Queries) GetMap(ctx context.Context, id uuid.UUID) (ThemeMap, error) {
	row := q.db.QueryRow(ctx, getMap, id)
	var i ThemeMap
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.Name,
		&i.ImageUrl,
		&i.SortOrder,
		&i.CreatedAt,
	)
	return i, err
}

const createMap = `-- name: CreateMap :one
INSERT INTO theme_maps (theme_id, name, image_url, sort_order)
VALUES ($1, $2, $3, $4)
RETURNING id, theme_id, name, image_url, sort_order, created_at`

type CreateMapParams struct {
	ThemeID   uuid.UUID   `json:"theme_id"`
	Name      string      `json:"name"`
	ImageUrl  pgtype.Text `json:"image_url"`
	SortOrder int32       `json:"sort_order"`
}

func (q *Queries) CreateMap(ctx context.Context, arg CreateMapParams) (ThemeMap, error) {
	row := q.db.QueryRow(ctx, createMap,
		arg.ThemeID,
		arg.Name,
		arg.ImageUrl,
		arg.SortOrder,
	)
	var i ThemeMap
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.Name,
		&i.ImageUrl,
		&i.SortOrder,
		&i.CreatedAt,
	)
	return i, err
}

const updateMap = `-- name: UpdateMap :one
UPDATE theme_maps SET name = $2, image_url = $3, sort_order = $4
WHERE id = $1
RETURNING id, theme_id, name, image_url, sort_order, created_at`

type UpdateMapParams struct {
	ID        uuid.UUID   `json:"id"`
	Name      string      `json:"name"`
	ImageUrl  pgtype.Text `json:"image_url"`
	SortOrder int32       `json:"sort_order"`
}

func (q *Queries) UpdateMap(ctx context.Context, arg UpdateMapParams) (ThemeMap, error) {
	row := q.db.QueryRow(ctx, updateMap,
		arg.ID,
		arg.Name,
		arg.ImageUrl,
		arg.SortOrder,
	)
	var i ThemeMap
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.Name,
		&i.ImageUrl,
		&i.SortOrder,
		&i.CreatedAt,
	)
	return i, err
}

const deleteMap = `-- name: DeleteMap :exec
DELETE FROM theme_maps WHERE id = $1`

func (q *Queries) DeleteMap(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, deleteMap, id)
	return err
}

const countMapsByTheme = `-- name: CountMapsByTheme :one
SELECT count(*) FROM theme_maps WHERE theme_id = $1`

func (q *Queries) CountMapsByTheme(ctx context.Context, themeID uuid.UUID) (int64, error) {
	row := q.db.QueryRow(ctx, countMapsByTheme, themeID)
	var count int64
	err := row.Scan(&count)
	return count, err
}

// ============================================================
// Locations
// ============================================================

const listLocationsByMap = `-- name: ListLocationsByMap :many
SELECT id, theme_id, map_id, name, restricted_characters, sort_order, created_at FROM theme_locations WHERE map_id = $1 ORDER BY sort_order`

func (q *Queries) ListLocationsByMap(ctx context.Context, mapID uuid.UUID) ([]ThemeLocation, error) {
	rows, err := q.db.Query(ctx, listLocationsByMap, mapID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ThemeLocation{}
	for rows.Next() {
		var i ThemeLocation
		if err := rows.Scan(
			&i.ID,
			&i.ThemeID,
			&i.MapID,
			&i.Name,
			&i.RestrictedCharacters,
			&i.SortOrder,
			&i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const listLocationsByTheme = `-- name: ListLocationsByTheme :many
SELECT id, theme_id, map_id, name, restricted_characters, sort_order, created_at FROM theme_locations WHERE theme_id = $1 ORDER BY sort_order`

func (q *Queries) ListLocationsByTheme(ctx context.Context, themeID uuid.UUID) ([]ThemeLocation, error) {
	rows, err := q.db.Query(ctx, listLocationsByTheme, themeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ThemeLocation{}
	for rows.Next() {
		var i ThemeLocation
		if err := rows.Scan(
			&i.ID,
			&i.ThemeID,
			&i.MapID,
			&i.Name,
			&i.RestrictedCharacters,
			&i.SortOrder,
			&i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const getLocation = `-- name: GetLocation :one
SELECT id, theme_id, map_id, name, restricted_characters, sort_order, created_at FROM theme_locations WHERE id = $1`

func (q *Queries) GetLocation(ctx context.Context, id uuid.UUID) (ThemeLocation, error) {
	row := q.db.QueryRow(ctx, getLocation, id)
	var i ThemeLocation
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.MapID,
		&i.Name,
		&i.RestrictedCharacters,
		&i.SortOrder,
		&i.CreatedAt,
	)
	return i, err
}

const createLocation = `-- name: CreateLocation :one
INSERT INTO theme_locations (theme_id, map_id, name, restricted_characters, sort_order)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, theme_id, map_id, name, restricted_characters, sort_order, created_at`

type CreateLocationParams struct {
	ThemeID              uuid.UUID   `json:"theme_id"`
	MapID                uuid.UUID   `json:"map_id"`
	Name                 string      `json:"name"`
	RestrictedCharacters pgtype.Text `json:"restricted_characters"`
	SortOrder            int32       `json:"sort_order"`
}

func (q *Queries) CreateLocation(ctx context.Context, arg CreateLocationParams) (ThemeLocation, error) {
	row := q.db.QueryRow(ctx, createLocation,
		arg.ThemeID,
		arg.MapID,
		arg.Name,
		arg.RestrictedCharacters,
		arg.SortOrder,
	)
	var i ThemeLocation
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.MapID,
		&i.Name,
		&i.RestrictedCharacters,
		&i.SortOrder,
		&i.CreatedAt,
	)
	return i, err
}

const updateLocation = `-- name: UpdateLocation :one
UPDATE theme_locations SET name = $2, restricted_characters = $3, sort_order = $4
WHERE id = $1
RETURNING id, theme_id, map_id, name, restricted_characters, sort_order, created_at`

type UpdateLocationParams struct {
	ID                   uuid.UUID   `json:"id"`
	Name                 string      `json:"name"`
	RestrictedCharacters pgtype.Text `json:"restricted_characters"`
	SortOrder            int32       `json:"sort_order"`
}

func (q *Queries) UpdateLocation(ctx context.Context, arg UpdateLocationParams) (ThemeLocation, error) {
	row := q.db.QueryRow(ctx, updateLocation,
		arg.ID,
		arg.Name,
		arg.RestrictedCharacters,
		arg.SortOrder,
	)
	var i ThemeLocation
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.MapID,
		&i.Name,
		&i.RestrictedCharacters,
		&i.SortOrder,
		&i.CreatedAt,
	)
	return i, err
}

const deleteLocation = `-- name: DeleteLocation :exec
DELETE FROM theme_locations WHERE id = $1`

func (q *Queries) DeleteLocation(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, deleteLocation, id)
	return err
}

const countLocationsByMap = `-- name: CountLocationsByMap :one
SELECT count(*) FROM theme_locations WHERE map_id = $1`

func (q *Queries) CountLocationsByMap(ctx context.Context, mapID uuid.UUID) (int64, error) {
	row := q.db.QueryRow(ctx, countLocationsByMap, mapID)
	var count int64
	err := row.Scan(&count)
	return count, err
}

// ============================================================
// Clues
// ============================================================

const listCluesByTheme = `-- name: ListCluesByTheme :many
SELECT id, theme_id, location_id, name, description, image_url, is_common, level, clue_type, sort_order, created_at FROM theme_clues WHERE theme_id = $1 ORDER BY sort_order`

func (q *Queries) ListCluesByTheme(ctx context.Context, themeID uuid.UUID) ([]ThemeClue, error) {
	rows, err := q.db.Query(ctx, listCluesByTheme, themeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ThemeClue{}
	for rows.Next() {
		var i ThemeClue
		if err := rows.Scan(
			&i.ID,
			&i.ThemeID,
			&i.LocationID,
			&i.Name,
			&i.Description,
			&i.ImageUrl,
			&i.IsCommon,
			&i.Level,
			&i.ClueType,
			&i.SortOrder,
			&i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const listCluesByLocation = `-- name: ListCluesByLocation :many
SELECT id, theme_id, location_id, name, description, image_url, is_common, level, clue_type, sort_order, created_at FROM theme_clues WHERE location_id = $1 ORDER BY sort_order`

func (q *Queries) ListCluesByLocation(ctx context.Context, locationID pgtype.UUID) ([]ThemeClue, error) {
	rows, err := q.db.Query(ctx, listCluesByLocation, locationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ThemeClue{}
	for rows.Next() {
		var i ThemeClue
		if err := rows.Scan(
			&i.ID,
			&i.ThemeID,
			&i.LocationID,
			&i.Name,
			&i.Description,
			&i.ImageUrl,
			&i.IsCommon,
			&i.Level,
			&i.ClueType,
			&i.SortOrder,
			&i.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const getClue = `-- name: GetClue :one
SELECT id, theme_id, location_id, name, description, image_url, is_common, level, clue_type, sort_order, created_at FROM theme_clues WHERE id = $1`

func (q *Queries) GetClue(ctx context.Context, id uuid.UUID) (ThemeClue, error) {
	row := q.db.QueryRow(ctx, getClue, id)
	var i ThemeClue
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.LocationID,
		&i.Name,
		&i.Description,
		&i.ImageUrl,
		&i.IsCommon,
		&i.Level,
		&i.ClueType,
		&i.SortOrder,
		&i.CreatedAt,
	)
	return i, err
}

const createClue = `-- name: CreateClue :one
INSERT INTO theme_clues (theme_id, location_id, name, description, image_url, is_common, level, clue_type, sort_order)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, theme_id, location_id, name, description, image_url, is_common, level, clue_type, sort_order, created_at`

type CreateClueParams struct {
	ThemeID     uuid.UUID   `json:"theme_id"`
	LocationID  pgtype.UUID `json:"location_id"`
	Name        string      `json:"name"`
	Description pgtype.Text `json:"description"`
	ImageUrl    pgtype.Text `json:"image_url"`
	IsCommon    bool        `json:"is_common"`
	Level       int32       `json:"level"`
	ClueType    string      `json:"clue_type"`
	SortOrder   int32       `json:"sort_order"`
}

func (q *Queries) CreateClue(ctx context.Context, arg CreateClueParams) (ThemeClue, error) {
	row := q.db.QueryRow(ctx, createClue,
		arg.ThemeID,
		arg.LocationID,
		arg.Name,
		arg.Description,
		arg.ImageUrl,
		arg.IsCommon,
		arg.Level,
		arg.ClueType,
		arg.SortOrder,
	)
	var i ThemeClue
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.LocationID,
		&i.Name,
		&i.Description,
		&i.ImageUrl,
		&i.IsCommon,
		&i.Level,
		&i.ClueType,
		&i.SortOrder,
		&i.CreatedAt,
	)
	return i, err
}

const updateClue = `-- name: UpdateClue :one
UPDATE theme_clues SET location_id = $2, name = $3, description = $4, image_url = $5, is_common = $6, level = $7, clue_type = $8, sort_order = $9
WHERE id = $1
RETURNING id, theme_id, location_id, name, description, image_url, is_common, level, clue_type, sort_order, created_at`

type UpdateClueParams struct {
	ID          uuid.UUID   `json:"id"`
	LocationID  pgtype.UUID `json:"location_id"`
	Name        string      `json:"name"`
	Description pgtype.Text `json:"description"`
	ImageUrl    pgtype.Text `json:"image_url"`
	IsCommon    bool        `json:"is_common"`
	Level       int32       `json:"level"`
	ClueType    string      `json:"clue_type"`
	SortOrder   int32       `json:"sort_order"`
}

func (q *Queries) UpdateClue(ctx context.Context, arg UpdateClueParams) (ThemeClue, error) {
	row := q.db.QueryRow(ctx, updateClue,
		arg.ID,
		arg.LocationID,
		arg.Name,
		arg.Description,
		arg.ImageUrl,
		arg.IsCommon,
		arg.Level,
		arg.ClueType,
		arg.SortOrder,
	)
	var i ThemeClue
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.LocationID,
		&i.Name,
		&i.Description,
		&i.ImageUrl,
		&i.IsCommon,
		&i.Level,
		&i.ClueType,
		&i.SortOrder,
		&i.CreatedAt,
	)
	return i, err
}

const deleteClue = `-- name: DeleteClue :exec
DELETE FROM theme_clues WHERE id = $1`

func (q *Queries) DeleteClue(ctx context.Context, id uuid.UUID) error {
	_, err := q.db.Exec(ctx, deleteClue, id)
	return err
}

const countCluesByTheme = `-- name: CountCluesByTheme :one
SELECT count(*) FROM theme_clues WHERE theme_id = $1`

func (q *Queries) CountCluesByTheme(ctx context.Context, themeID uuid.UUID) (int64, error) {
	row := q.db.QueryRow(ctx, countCluesByTheme, themeID)
	var count int64
	err := row.Scan(&count)
	return count, err
}

// ============================================================
// Contents
// ============================================================

const getContent = `-- name: GetContent :one
SELECT id, theme_id, key, body, updated_at FROM theme_contents WHERE theme_id = $1 AND key = $2`

type GetContentParams struct {
	ThemeID uuid.UUID `json:"theme_id"`
	Key     string    `json:"key"`
}

func (q *Queries) GetContent(ctx context.Context, arg GetContentParams) (ThemeContent, error) {
	row := q.db.QueryRow(ctx, getContent, arg.ThemeID, arg.Key)
	var i ThemeContent
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.Key,
		&i.Body,
		&i.UpdatedAt,
	)
	return i, err
}

const upsertContent = `-- name: UpsertContent :one
INSERT INTO theme_contents (theme_id, key, body, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (theme_id, key) DO UPDATE SET body = EXCLUDED.body, updated_at = NOW()
RETURNING id, theme_id, key, body, updated_at`

type UpsertContentParams struct {
	ThemeID uuid.UUID `json:"theme_id"`
	Key     string    `json:"key"`
	Body    string    `json:"body"`
}

func (q *Queries) UpsertContent(ctx context.Context, arg UpsertContentParams) (ThemeContent, error) {
	row := q.db.QueryRow(ctx, upsertContent, arg.ThemeID, arg.Key, arg.Body)
	var i ThemeContent
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.Key,
		&i.Body,
		&i.UpdatedAt,
	)
	return i, err
}

const listContentsByTheme = `-- name: ListContentsByTheme :many
SELECT id, theme_id, key, body, updated_at FROM theme_contents WHERE theme_id = $1 ORDER BY key`

func (q *Queries) ListContentsByTheme(ctx context.Context, themeID uuid.UUID) ([]ThemeContent, error) {
	rows, err := q.db.Query(ctx, listContentsByTheme, themeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []ThemeContent{}
	for rows.Next() {
		var i ThemeContent
		if err := rows.Scan(
			&i.ID,
			&i.ThemeID,
			&i.Key,
			&i.Body,
			&i.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const deleteContent = `-- name: DeleteContent :exec
DELETE FROM theme_contents WHERE theme_id = $1 AND key = $2`

type DeleteContentParams struct {
	ThemeID uuid.UUID `json:"theme_id"`
	Key     string    `json:"key"`
}

func (q *Queries) DeleteContent(ctx context.Context, arg DeleteContentParams) error {
	_, err := q.db.Exec(ctx, deleteContent, arg.ThemeID, arg.Key)
	return err
}

// ============================================================
// Ownership verification (JOIN-based, single query)
// ============================================================

const getMapWithOwner = `-- name: GetMapWithOwner :one
SELECT m.id, m.theme_id, m.name, m.image_url, m.sort_order, m.created_at FROM theme_maps m
JOIN themes t ON m.theme_id = t.id
WHERE m.id = $1 AND t.creator_id = $2`

type GetMapWithOwnerParams struct {
	ID        uuid.UUID `json:"id"`
	CreatorID uuid.UUID `json:"creator_id"`
}

func (q *Queries) GetMapWithOwner(ctx context.Context, arg GetMapWithOwnerParams) (ThemeMap, error) {
	row := q.db.QueryRow(ctx, getMapWithOwner, arg.ID, arg.CreatorID)
	var i ThemeMap
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.Name,
		&i.ImageUrl,
		&i.SortOrder,
		&i.CreatedAt,
	)
	return i, err
}

const getLocationWithOwner = `-- name: GetLocationWithOwner :one
SELECT l.id, l.theme_id, l.map_id, l.name, l.restricted_characters, l.sort_order, l.created_at FROM theme_locations l
JOIN themes t ON l.theme_id = t.id
WHERE l.id = $1 AND t.creator_id = $2`

type GetLocationWithOwnerParams struct {
	ID        uuid.UUID `json:"id"`
	CreatorID uuid.UUID `json:"creator_id"`
}

func (q *Queries) GetLocationWithOwner(ctx context.Context, arg GetLocationWithOwnerParams) (ThemeLocation, error) {
	row := q.db.QueryRow(ctx, getLocationWithOwner, arg.ID, arg.CreatorID)
	var i ThemeLocation
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.MapID,
		&i.Name,
		&i.RestrictedCharacters,
		&i.SortOrder,
		&i.CreatedAt,
	)
	return i, err
}

const getClueWithOwner = `-- name: GetClueWithOwner :one
SELECT c.id, c.theme_id, c.location_id, c.name, c.description, c.image_url, c.is_common, c.level, c.clue_type, c.sort_order, c.created_at FROM theme_clues c
JOIN themes t ON c.theme_id = t.id
WHERE c.id = $1 AND t.creator_id = $2`

type GetClueWithOwnerParams struct {
	ID        uuid.UUID `json:"id"`
	CreatorID uuid.UUID `json:"creator_id"`
}

func (q *Queries) GetClueWithOwner(ctx context.Context, arg GetClueWithOwnerParams) (ThemeClue, error) {
	row := q.db.QueryRow(ctx, getClueWithOwner, arg.ID, arg.CreatorID)
	var i ThemeClue
	err := row.Scan(
		&i.ID,
		&i.ThemeID,
		&i.LocationID,
		&i.Name,
		&i.Description,
		&i.ImageUrl,
		&i.IsCommon,
		&i.Level,
		&i.ClueType,
		&i.SortOrder,
		&i.CreatedAt,
	)
	return i, err
}

const deleteMapWithOwner = `-- name: DeleteMapWithOwner :execrows
DELETE FROM theme_maps m USING themes t
WHERE m.id = $1 AND m.theme_id = t.id AND t.creator_id = $2`

type DeleteMapWithOwnerParams struct {
	ID        uuid.UUID `json:"id"`
	CreatorID uuid.UUID `json:"creator_id"`
}

func (q *Queries) DeleteMapWithOwner(ctx context.Context, arg DeleteMapWithOwnerParams) (int64, error) {
	result, err := q.db.Exec(ctx, deleteMapWithOwner, arg.ID, arg.CreatorID)
	return result.RowsAffected(), err
}

const deleteLocationWithOwner = `-- name: DeleteLocationWithOwner :execrows
DELETE FROM theme_locations l USING themes t
WHERE l.id = $1 AND l.theme_id = t.id AND t.creator_id = $2`

type DeleteLocationWithOwnerParams struct {
	ID        uuid.UUID `json:"id"`
	CreatorID uuid.UUID `json:"creator_id"`
}

func (q *Queries) DeleteLocationWithOwner(ctx context.Context, arg DeleteLocationWithOwnerParams) (int64, error) {
	result, err := q.db.Exec(ctx, deleteLocationWithOwner, arg.ID, arg.CreatorID)
	return result.RowsAffected(), err
}

const deleteClueWithOwner = `-- name: DeleteClueWithOwner :execrows
DELETE FROM theme_clues c USING themes t
WHERE c.id = $1 AND c.theme_id = t.id AND t.creator_id = $2`

type DeleteClueWithOwnerParams struct {
	ID        uuid.UUID `json:"id"`
	CreatorID uuid.UUID `json:"creator_id"`
}

func (q *Queries) DeleteClueWithOwner(ctx context.Context, arg DeleteClueWithOwnerParams) (int64, error) {
	result, err := q.db.Exec(ctx, deleteClueWithOwner, arg.ID, arg.CreatorID)
	return result.RowsAffected(), err
}
