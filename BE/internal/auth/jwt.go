package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("token has expired")
)

// TokenType represents the type of JWT token
type TokenType string

const (
	AccessToken  TokenType = "access"
	RefreshToken TokenType = "refresh"
)

// Claims represents JWT claims for RRNET
type Claims struct {
	jwt.RegisteredClaims
	UserID    uuid.UUID `json:"user_id"`
	TenantID  uuid.UUID `json:"tenant_id,omitempty"`
	Role      string    `json:"role"`
	TokenType TokenType `json:"token_type"`
	Email     string    `json:"email,omitempty"`
}

// JWTManager handles JWT token operations
type JWTManager struct {
	secretKey       []byte
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
	issuer          string
}

// NewJWTManager creates a new JWT manager
func NewJWTManager(secret string, accessTTL, refreshTTL time.Duration) *JWTManager {
	return &JWTManager{
		secretKey:       []byte(secret),
		accessTokenTTL:  accessTTL,
		refreshTokenTTL: refreshTTL,
		issuer:          "rrnet",
	}
}

// GenerateAccessToken creates a new access token
func (j *JWTManager) GenerateAccessToken(userID, tenantID uuid.UUID, role, email string) (string, error) {
	return j.generateToken(userID, tenantID, role, email, AccessToken, j.accessTokenTTL)
}

// GenerateRefreshToken creates a new refresh token
func (j *JWTManager) GenerateRefreshToken(userID, tenantID uuid.UUID, role, email string) (string, error) {
	return j.generateToken(userID, tenantID, role, email, RefreshToken, j.refreshTokenTTL)
}

// generateToken creates a JWT token with the given parameters
func (j *JWTManager) generateToken(userID, tenantID uuid.UUID, role, email string, tokenType TokenType, ttl time.Duration) (string, error) {
	now := time.Now()

	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    j.issuer,
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			NotBefore: jwt.NewNumericDate(now),
			ID:        uuid.New().String(),
		},
		UserID:    userID,
		TenantID:  tenantID,
		Role:      role,
		TokenType: tokenType,
		Email:     email,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(j.secretKey)
}

// ValidateToken validates and parses a JWT token
func (j *JWTManager) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return j.secretKey, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// ValidateAccessToken validates an access token
func (j *JWTManager) ValidateAccessToken(tokenString string) (*Claims, error) {
	claims, err := j.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.TokenType != AccessToken {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// ValidateRefreshToken validates a refresh token
func (j *JWTManager) ValidateRefreshToken(tokenString string) (*Claims, error) {
	claims, err := j.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	if claims.TokenType != RefreshToken {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// GetAccessTokenTTL returns the access token TTL
func (j *JWTManager) GetAccessTokenTTL() time.Duration {
	return j.accessTokenTTL
}

// GetRefreshTokenTTL returns the refresh token TTL
func (j *JWTManager) GetRefreshTokenTTL() time.Duration {
	return j.refreshTokenTTL
}






























