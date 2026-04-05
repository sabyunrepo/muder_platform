package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/apperror"
)

const (
	UserIDKey   contextKey = "userID"
	UserRoleKey contextKey = "userRole"
)

// JWTConfig holds JWT validation configuration.
type JWTConfig struct {
	Secret []byte
}

// Auth returns middleware that validates JWT Bearer tokens.
func Auth(cfg JWTConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" {
				apperror.WriteError(w, r, apperror.New(apperror.ErrAuthTokenMissing, http.StatusUnauthorized, "missing authorization header"))
				return
			}

			tokenStr := strings.TrimPrefix(header, "Bearer ")
			if tokenStr == header {
				apperror.WriteError(w, r, apperror.Unauthorized("invalid authorization format"))
				return
			}

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, apperror.Unauthorized("unexpected signing method")
				}
				return cfg.Secret, nil
			})
			if err != nil || !token.Valid {
				apperror.WriteError(w, r, apperror.New(apperror.ErrAuthTokenInvalid, http.StatusUnauthorized, "invalid or expired token"))
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				apperror.WriteError(w, r, apperror.Unauthorized("invalid token claims"))
				return
			}

			sub, _ := claims.GetSubject()
			userID, err := uuid.Parse(sub)
			if err != nil {
				apperror.WriteError(w, r, apperror.Unauthorized("invalid user ID in token"))
				return
			}

			role, _ := claims["role"].(string)
			if role == "" {
				role = "PLAYER"
			}

			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			ctx = context.WithValue(ctx, UserRoleKey, role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserIDFrom extracts the user ID from the request context.
func UserIDFrom(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(UserIDKey).(uuid.UUID)
	return id
}

// UserRoleFrom extracts the user role from the request context.
func UserRoleFrom(ctx context.Context) string {
	role, _ := ctx.Value(UserRoleKey).(string)
	return role
}

// RequireRole returns middleware that checks the user has one of the required roles.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	roleSet := make(map[string]bool, len(roles))
	for _, r := range roles {
		roleSet[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role := UserRoleFrom(r.Context())
			if !roleSet[role] {
				apperror.WriteError(w, r, apperror.Forbidden("insufficient permissions"))
				return
			}
			next.ServeHTTP(w, r.WithContext(r.Context()))
		})
	}
}
