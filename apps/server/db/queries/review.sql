-- name: ListPendingReviewThemes :many
SELECT t.*, u.nickname AS creator_name
FROM themes t
JOIN users u ON t.creator_id = u.id
WHERE t.status = 'PENDING_REVIEW'
ORDER BY t.updated_at ASC;

-- name: ApproveTheme :one
UPDATE themes
SET status       = 'PUBLISHED',
    published_at = NOW(),
    reviewed_at  = NOW(),
    reviewed_by  = $2,
    review_note  = $3,
    updated_at   = NOW()
WHERE id = $1
RETURNING *;

-- name: RejectTheme :one
UPDATE themes
SET status      = 'REJECTED',
    reviewed_at = NOW(),
    reviewed_by = $2,
    review_note = $3,
    updated_at  = NOW()
WHERE id = $1
RETURNING *;

-- name: SubmitThemeForReview :one
UPDATE themes
SET status      = 'PENDING_REVIEW',
    review_note = NULL,
    reviewed_at = NULL,
    reviewed_by = NULL,
    updated_at  = NOW()
WHERE id = $1
RETURNING *;

-- name: UnpublishTheme :one
UPDATE themes
SET status     = 'UNPUBLISHED',
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SuspendTheme :one
UPDATE themes
SET status      = 'SUSPENDED',
    reviewed_at = NOW(),
    reviewed_by = $2,
    review_note = $3,
    updated_at  = NOW()
WHERE id = $1
RETURNING *;

-- name: SetUserTrustedCreator :exec
UPDATE users SET trusted_creator = $2 WHERE id = $1;

-- name: GetUserTrustedCreator :one
SELECT trusted_creator FROM users WHERE id = $1;
