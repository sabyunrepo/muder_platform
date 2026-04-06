package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"golang.org/x/crypto/bcrypt"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// TokenPair holds the access and refresh tokens returned to the client.
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

// UserResponse is the public representation of a user.
type UserResponse struct {
	ID        uuid.UUID `json:"id"`
	Nickname  string    `json:"nickname"`
	Email     *string   `json:"email,omitempty"`
	AvatarURL *string   `json:"avatar_url,omitempty"`
	Role      string    `json:"role"`
}

// DeleteAccountRequest holds the payload for account deletion.
type DeleteAccountRequest struct {
	Password string `json:"password" validate:"required"`
}

// Service defines the auth domain operations.
type Service interface {
	OAuthCallback(ctx context.Context, provider, code, nickname string) (*TokenPair, error)
	Register(ctx context.Context, email, password, nickname string) (*TokenPair, error)
	Login(ctx context.Context, email, password string) (*TokenPair, error)
	RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error)
	Logout(ctx context.Context, userID uuid.UUID) error
	GetCurrentUser(ctx context.Context, userID uuid.UUID) (*UserResponse, error)
	DeleteAccount(ctx context.Context, userID uuid.UUID, req DeleteAccountRequest) error
}

type service struct {
	queries   *db.Queries
	redis     *redis.Client
	jwtSecret []byte
	logger    zerolog.Logger
}

// NewService creates a new auth service.
func NewService(queries *db.Queries, redisClient *redis.Client, jwtSecret []byte, logger zerolog.Logger) Service {
	return &service{
		queries:   queries,
		redis:     redisClient,
		jwtSecret: jwtSecret,
		logger:    logger.With().Str("domain", "auth").Logger(),
	}
}

// refreshKeyPrefix returns the Redis key prefix for a user's refresh tokens.
func refreshKeyPrefix(userID string) string {
	return fmt.Sprintf("refresh:%s:", userID)
}

// refreshKey returns the full Redis key for a specific refresh token.
func refreshKey(userID, jti string) string {
	return fmt.Sprintf("refresh:%s:%s", userID, jti)
}

// OAuthCallback handles the OAuth callback flow.
// It looks up or creates the user, then returns a token pair.
func (s *service) OAuthCallback(ctx context.Context, provider, code, nickname string) (*TokenPair, error) {
	if provider == "" || code == "" || nickname == "" {
		return nil, apperror.BadRequest("provider, code, and nickname are required")
	}

	// Look up existing user by provider + providerID (code used as providerID for now).
	user, err := s.queries.GetUserByProvider(ctx, db.GetUserByProviderParams{
		Provider:   provider,
		ProviderID: code,
	})
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			s.logger.Error().Err(err).Str("provider", provider).Msg("failed to look up user by provider")
			return nil, apperror.Internal("failed to look up user")
		}

		// User not found — create a new one.
		user, err = s.queries.CreateUser(ctx, db.CreateUserParams{
			Nickname:   nickname,
			Email:      pgtype.Text{},
			AvatarUrl:  pgtype.Text{},
			Provider:   provider,
			ProviderID: code,
		})
		if err != nil {
			s.logger.Error().Err(err).Str("provider", provider).Msg("failed to create user")
			return nil, apperror.Internal("failed to create user")
		}
		s.logger.Info().Str("user_id", user.ID.String()).Msg("new user created via OAuth")
	}

	pair, err := s.generateTokenPair(ctx, user.ID, user.Role)
	if err != nil {
		return nil, err
	}

	return pair, nil
}

// RefreshToken validates the refresh token and performs rotation.
// If the token's JTI is not found in Redis, all tokens for the user are revoked (family attack detection).
func (s *service) RefreshToken(ctx context.Context, refreshTokenStr string) (*TokenPair, error) {
	if refreshTokenStr == "" {
		return nil, apperror.BadRequest("refresh_token is required")
	}

	token, err := jwt.Parse(refreshTokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return nil, apperror.Unauthorized("invalid or expired refresh token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, apperror.Unauthorized("invalid token claims")
	}

	tokenType, _ := claims["type"].(string)
	if tokenType != "refresh" {
		return nil, apperror.Unauthorized("token is not a refresh token")
	}

	sub, err := claims.GetSubject()
	if err != nil {
		return nil, apperror.Unauthorized("invalid token subject")
	}

	jti, _ := claims["jti"].(string)
	if jti == "" {
		return nil, apperror.Unauthorized("invalid token ID")
	}

	userID, err := uuid.Parse(sub)
	if err != nil {
		return nil, apperror.Unauthorized("invalid user ID in token")
	}

	// Check if the refresh token JTI exists in Redis.
	key := refreshKey(sub, jti)
	exists, err := s.redis.Exists(ctx, key).Result()
	if err != nil {
		s.logger.Error().Err(err).Msg("redis error checking refresh token")
		return nil, apperror.Internal("failed to validate refresh token")
	}

	if exists == 0 {
		// Token reuse detected — revoke all tokens for this user (family attack).
		s.logger.Warn().Str("user_id", sub).Str("jti", jti).Msg("refresh token reuse detected, revoking all tokens")
		s.revokeAllTokens(ctx, sub)
		return nil, apperror.Unauthorized("refresh token has been revoked")
	}

	// Delete the old refresh token (single use).
	s.redis.Del(ctx, key)

	// Look up user to get current role.
	user, err := s.queries.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("user not found")
		}
		s.logger.Error().Err(err).Msg("failed to get user for refresh")
		return nil, apperror.Internal("failed to get user")
	}

	pair, err := s.generateTokenPair(ctx, user.ID, user.Role)
	if err != nil {
		return nil, err
	}

	return pair, nil
}

// Logout revokes all refresh tokens for the given user.
func (s *service) Logout(ctx context.Context, userID uuid.UUID) error {
	s.revokeAllTokens(ctx, userID.String())
	s.logger.Info().Str("user_id", userID.String()).Msg("user logged out, all refresh tokens revoked")
	return nil
}

// GetCurrentUser returns the public user information.
func (s *service) GetCurrentUser(ctx context.Context, userID uuid.UUID) (*UserResponse, error) {
	user, err := s.queries.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("user not found")
		}
		s.logger.Error().Err(err).Msg("failed to get current user")
		return nil, apperror.Internal("failed to get user")
	}
	return mapUserResponse(user), nil
}

// generateTokenPair creates a new access+refresh token pair and stores the refresh JTI in Redis.
func (s *service) generateTokenPair(ctx context.Context, userID uuid.UUID, role string) (*TokenPair, error) {
	accessToken, err := GenerateAccessToken(userID, role, s.jwtSecret)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to generate access token")
		return nil, apperror.Internal("failed to generate access token")
	}

	refreshToken, jti, err := GenerateRefreshToken(userID, s.jwtSecret)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to generate refresh token")
		return nil, apperror.Internal("failed to generate refresh token")
	}

	// Store refresh token JTI in Redis with TTL.
	key := refreshKey(userID.String(), jti)
	if err := s.redis.Set(ctx, key, "1", RefreshTokenDuration).Err(); err != nil {
		s.logger.Error().Err(err).Msg("failed to store refresh token in Redis")
		return nil, apperror.Internal("failed to store refresh token")
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int(AccessTokenDuration.Seconds()),
	}, nil
}

// revokeAllTokens deletes all refresh tokens for a user using SCAN to avoid blocking Redis.
func (s *service) revokeAllTokens(ctx context.Context, userID string) {
	pattern := refreshKeyPrefix(userID) + "*"
	var cursor uint64
	for {
		keys, nextCursor, err := s.redis.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			s.logger.Error().Err(err).Str("user_id", userID).Msg("failed to scan refresh tokens for revocation")
			return
		}
		if len(keys) > 0 {
			s.redis.Del(ctx, keys...)
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
}

// Register creates a new user with email/password.
func (s *service) Register(ctx context.Context, email, password, nickname string) (*TokenPair, error) {
	if email == "" || password == "" || nickname == "" {
		return nil, apperror.BadRequest("email, password, and nickname are required")
	}

	// Check if email already exists.
	_, err := s.queries.GetUserByEmail(ctx, pgtype.Text{String: email, Valid: true})
	if err == nil {
		return nil, apperror.Conflict("email already registered")
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		s.logger.Error().Err(err).Msg("failed to check existing user")
		return nil, apperror.Internal("failed to check existing user")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to hash password")
		return nil, apperror.Internal("failed to hash password")
	}

	user, err := s.queries.CreateUserWithPassword(ctx, db.CreateUserWithPasswordParams{
		Nickname:     nickname,
		Email:        pgtype.Text{String: email, Valid: true},
		PasswordHash: pgtype.Text{String: string(hash), Valid: true},
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create user")
		return nil, apperror.Internal("failed to create user")
	}

	s.logger.Info().Str("user_id", user.ID.String()).Msg("new user registered with password")
	return s.generateTokenPair(ctx, user.ID, user.Role)
}

// Login authenticates a user with email/password.
func (s *service) Login(ctx context.Context, email, password string) (*TokenPair, error) {
	if email == "" || password == "" {
		return nil, apperror.BadRequest("email and password are required")
	}

	user, err := s.queries.GetUserByEmail(ctx, pgtype.Text{String: email, Valid: true})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.Unauthorized("invalid email or password")
		}
		s.logger.Error().Err(err).Msg("failed to look up user by email")
		return nil, apperror.Internal("failed to look up user")
	}

	if !user.PasswordHash.Valid {
		return nil, apperror.Unauthorized("invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash.String), []byte(password)); err != nil {
		return nil, apperror.Unauthorized("invalid email or password")
	}

	return s.generateTokenPair(ctx, user.ID, user.Role)
}

// DeleteAccount soft-deletes the user account after verifying identity.
// OAuth-only users (no password_hash) may delete without a password.
func (s *service) DeleteAccount(ctx context.Context, userID uuid.UUID, req DeleteAccountRequest) error {
	user, err := s.queries.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.Unauthorized("authentication required")
		}
		s.logger.Error().Err(err).Str("user_id", userID.String()).Msg("failed to get user for deletion")
		return apperror.Internal("failed to get user")
	}

	// Password users must confirm with their password.
	if user.PasswordHash.Valid && user.PasswordHash.String != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash.String), []byte(req.Password)); err != nil {
			return apperror.Unauthorized("authentication required")
		}
	}

	if err := s.queries.SoftDeleteUser(ctx, userID); err != nil {
		s.logger.Error().Err(err).Str("user_id", userID.String()).Msg("failed to soft delete user")
		return apperror.Internal("failed to delete account")
	}

	s.revokeAllTokens(ctx, userID.String())
	s.logger.Info().Str("user_id", userID.String()).Msg("user account soft deleted")
	return nil
}

// mapUserResponse converts a db.User to a public UserResponse.
func mapUserResponse(u db.User) *UserResponse {
	resp := &UserResponse{
		ID:       u.ID,
		Nickname: u.Nickname,
		Role:     u.Role,
	}
	if u.Email.Valid {
		resp.Email = &u.Email.String
	}
	if u.AvatarUrl.Valid {
		resp.AvatarURL = &u.AvatarUrl.String
	}
	return resp
}
