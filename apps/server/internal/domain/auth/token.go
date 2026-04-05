package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	// AccessTokenDuration is the lifetime of an access token.
	AccessTokenDuration = 15 * time.Minute
	// RefreshTokenDuration is the lifetime of a refresh token.
	RefreshTokenDuration = 30 * 24 * time.Hour
)

// GenerateAccessToken creates a signed JWT access token for the given user.
func GenerateAccessToken(userID uuid.UUID, role string, secret []byte) (string, error) {
	claims := jwt.MapClaims{
		"sub":  userID.String(),
		"role": role,
		"exp":  jwt.NewNumericDate(time.Now().Add(AccessTokenDuration)),
		"iat":  jwt.NewNumericDate(time.Now()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

// GenerateRefreshToken creates a signed JWT refresh token with a unique JTI.
// Returns the signed token string and the JTI for storage.
func GenerateRefreshToken(userID uuid.UUID, secret []byte) (string, string, error) {
	jti := uuid.New().String()
	claims := jwt.MapClaims{
		"sub":  userID.String(),
		"type": "refresh",
		"jti":  jti,
		"exp":  jwt.NewNumericDate(time.Now().Add(RefreshTokenDuration)),
		"iat":  jwt.NewNumericDate(time.Now()),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		return "", "", err
	}
	return signed, jti, nil
}
