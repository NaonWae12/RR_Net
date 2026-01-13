package fixtures

import (
	"time"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/domain/user"
)

// CreateTestUser creates a test user entity
func CreateTestUser(tenantID *uuid.UUID, email, name, password string, roleID uuid.UUID) (*user.User, error) {
	passwordHash, err := auth.HashPassword(password)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	return &user.User{
		ID:           uuid.New(),
		TenantID:     tenantID,
		RoleID:       roleID,
		Email:        email,
		PasswordHash: passwordHash,
		Name:         name,
		Status:       user.StatusActive,
		Metadata:     make(map[string]interface{}),
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

// CreateTestSuperAdmin creates a super admin user (no tenant)
func CreateTestSuperAdmin(email, name, password string, roleID uuid.UUID) (*user.User, error) {
	return CreateTestUser(nil, email, name, password, roleID)
}

// CreateInactiveUser creates an inactive test user
func CreateInactiveUser(tenantID *uuid.UUID, email, name, password string, roleID uuid.UUID) (*user.User, error) {
	u, err := CreateTestUser(tenantID, email, name, password, roleID)
	if err != nil {
		return nil, err
	}
	u.Status = user.StatusInactive
	return u, nil
}

