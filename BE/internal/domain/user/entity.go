package user

import (
	"time"

	"github.com/google/uuid"
)

// Status represents user status
type Status string

const (
	StatusActive    Status = "active"
	StatusInactive  Status = "inactive"
	StatusSuspended Status = "suspended"
)

// User represents a user in the system
type User struct {
	ID              uuid.UUID              `json:"id"`
	TenantID        *uuid.UUID             `json:"tenant_id,omitempty"` // nil for super_admin
	RoleID          uuid.UUID              `json:"role_id"`
	Email           string                 `json:"email"`
	PasswordHash    string                 `json:"-"` // Never expose in JSON
	Name            string                 `json:"name"`
	Phone           *string                `json:"phone,omitempty"`
	AvatarURL       *string                `json:"avatar_url,omitempty"`
	Status          Status                 `json:"status"`
	EmailVerifiedAt *time.Time             `json:"email_verified_at,omitempty"`
	LastLoginAt     *time.Time             `json:"last_login_at,omitempty"`
	Metadata        map[string]interface{} `json:"metadata"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
	DeletedAt       *time.Time             `json:"deleted_at,omitempty"`

	// Joined fields (not in DB, populated from joins)
	Role *Role `json:"role,omitempty"`
}

// Role represents a role with its code
type Role struct {
	ID          uuid.UUID `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
}

// IsActive checks if user is active
func (u *User) IsActive() bool {
	return u.Status == StatusActive && u.DeletedAt == nil
}

// IsSuperAdmin checks if user is a super admin (no tenant)
func (u *User) IsSuperAdmin() bool {
	return u.TenantID == nil
}

// CanLogin checks if user can login
func (u *User) CanLogin() bool {
	return u.Status == StatusActive && u.DeletedAt == nil
}





























