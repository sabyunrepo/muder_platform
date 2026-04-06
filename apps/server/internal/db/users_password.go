package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
)

const getUserByEmail = `
SELECT id, nickname, email, avatar_url, role, provider, provider_id, coin_balance, created_at, updated_at, password_hash
FROM users WHERE email = $1 AND provider = 'local'
`

// UserWithPassword extends User with password_hash for local auth.
type UserWithPassword struct {
	User
	PasswordHash pgtype.Text `json:"-"`
}

func (q *Queries) GetUserByEmail(ctx context.Context, email string) (UserWithPassword, error) {
	row := q.db.QueryRow(ctx, getUserByEmail, email)
	var i UserWithPassword
	err := row.Scan(
		&i.ID,
		&i.Nickname,
		&i.Email,
		&i.AvatarUrl,
		&i.Role,
		&i.Provider,
		&i.ProviderID,
		&i.CoinBalance,
		&i.CreatedAt,
		&i.UpdatedAt,
		&i.PasswordHash,
	)
	return i, err
}

const createUserWithPassword = `
INSERT INTO users (nickname, email, password_hash, provider, provider_id)
VALUES ($1, $2, $3, 'local', $2)
RETURNING id, nickname, email, avatar_url, role, provider, provider_id, coin_balance, created_at, updated_at
`

type CreateUserWithPasswordParams struct {
	Nickname     string `json:"nickname"`
	Email        string `json:"email"`
	PasswordHash string `json:"password_hash"`
}

func (q *Queries) CreateUserWithPassword(ctx context.Context, arg CreateUserWithPasswordParams) (User, error) {
	row := q.db.QueryRow(ctx, createUserWithPassword, arg.Nickname, arg.Email, arg.PasswordHash)
	var i User
	err := row.Scan(
		&i.ID,
		&i.Nickname,
		&i.Email,
		&i.AvatarUrl,
		&i.Role,
		&i.Provider,
		&i.ProviderID,
		&i.CoinBalance,
		&i.CreatedAt,
		&i.UpdatedAt,
	)
	return i, err
}
