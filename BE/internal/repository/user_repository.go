package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/user"
)

var (
	ErrUserNotFound       = errors.New("user not found")
	ErrEmailTaken         = errors.New("email already taken")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

// UserRepository handles user database operations
type UserRepository struct {
	db *pgxpool.Pool
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

// Create creates a new user
func (r *UserRepository) Create(ctx context.Context, u *user.User) error {
	query := `
		INSERT INTO users (id, tenant_id, role_id, email, password_hash, name, phone, avatar_url, status, email_verified_at, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	_, err := r.db.Exec(ctx, query,
		u.ID, u.TenantID, u.RoleID, u.Email, u.PasswordHash, u.Name, u.Phone, u.AvatarURL, u.Status, u.EmailVerifiedAt, u.Metadata, u.CreatedAt, u.UpdatedAt,
	)
	return err
}

// GetByID retrieves a user by ID
func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*user.User, error) {
	query := `
		SELECT u.id, u.tenant_id, u.role_id, u.email, u.password_hash, u.name, u.phone, u.avatar_url, u.status, 
		       u.email_verified_at, u.last_login_at, u.metadata, u.created_at, u.updated_at, u.deleted_at,
		       r.id, r.code, r.name, r.description
		FROM users u
		JOIN roles r ON u.role_id = r.id
		WHERE u.id = $1 AND u.deleted_at IS NULL
	`
	var u user.User
	var role user.Role
	err := r.db.QueryRow(ctx, query, id).Scan(
		&u.ID, &u.TenantID, &u.RoleID, &u.Email, &u.PasswordHash, &u.Name, &u.Phone, &u.AvatarURL, &u.Status,
		&u.EmailVerifiedAt, &u.LastLoginAt, &u.Metadata, &u.CreatedAt, &u.UpdatedAt, &u.DeletedAt,
		&role.ID, &role.Code, &role.Name, &role.Description,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	u.Role = &role
	return &u, nil
}

// GetByEmail retrieves a user by email within a tenant (or platform-wide for super_admin)
func (r *UserRepository) GetByEmail(ctx context.Context, tenantID *uuid.UUID, email string) (*user.User, error) {
	query := `
		SELECT u.id, u.tenant_id, u.role_id, u.email, u.password_hash, u.name, u.phone, u.avatar_url, u.status, 
		       u.email_verified_at, u.last_login_at, u.metadata, u.created_at, u.updated_at, u.deleted_at,
		       r.id, r.code, r.name, r.description
		FROM users u
		JOIN roles r ON u.role_id = r.id
		WHERE u.email = $1 AND u.deleted_at IS NULL
	`
	args := []interface{}{email}

	if tenantID != nil {
		query += ` AND u.tenant_id = $2`
		args = append(args, *tenantID)
	} else {
		query += ` AND u.tenant_id IS NULL`
	}

	var u user.User
	var role user.Role
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&u.ID, &u.TenantID, &u.RoleID, &u.Email, &u.PasswordHash, &u.Name, &u.Phone, &u.AvatarURL, &u.Status,
		&u.EmailVerifiedAt, &u.LastLoginAt, &u.Metadata, &u.CreatedAt, &u.UpdatedAt, &u.DeletedAt,
		&role.ID, &role.Code, &role.Name, &role.Description,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	u.Role = &role
	return &u, nil
}

// GetByEmailAnyTenant retrieves a user by email from any tenant (for login with email only)
func (r *UserRepository) GetByEmailAnyTenant(ctx context.Context, email string) (*user.User, error) {
	query := `
		SELECT u.id, u.tenant_id, u.role_id, u.email, u.password_hash, u.name, u.phone, u.avatar_url, u.status, 
		       u.email_verified_at, u.last_login_at, u.metadata, u.created_at, u.updated_at, u.deleted_at,
		       r.id, r.code, r.name, r.description
		FROM users u
		JOIN roles r ON u.role_id = r.id
		WHERE u.email = $1 AND u.deleted_at IS NULL
		LIMIT 1
	`
	var u user.User
	var role user.Role
	err := r.db.QueryRow(ctx, query, email).Scan(
		&u.ID, &u.TenantID, &u.RoleID, &u.Email, &u.PasswordHash, &u.Name, &u.Phone, &u.AvatarURL, &u.Status,
		&u.EmailVerifiedAt, &u.LastLoginAt, &u.Metadata, &u.CreatedAt, &u.UpdatedAt, &u.DeletedAt,
		&role.ID, &role.Code, &role.Name, &role.Description,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	u.Role = &role
	return &u, nil
}

// Update updates a user
func (r *UserRepository) Update(ctx context.Context, u *user.User) error {
	query := `
		UPDATE users
		SET role_id = $2, email = $3, name = $4, phone = $5, avatar_url = $6, status = $7, metadata = $8, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`
	result, err := r.db.Exec(ctx, query,
		u.ID, u.RoleID, u.Email, u.Name, u.Phone, u.AvatarURL, u.Status, u.Metadata,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

// UpdatePassword updates user password
func (r *UserRepository) UpdatePassword(ctx context.Context, id uuid.UUID, passwordHash string) error {
	query := `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`
	result, err := r.db.Exec(ctx, query, id, passwordHash)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

// UpdateLastLogin updates last login timestamp
func (r *UserRepository) UpdateLastLogin(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// SoftDelete soft deletes a user
func (r *UserRepository) SoftDelete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL`
	result, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

// EmailExists checks if email is taken within a tenant
func (r *UserRepository) EmailExists(ctx context.Context, tenantID *uuid.UUID, email string, excludeID *uuid.UUID) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 AND deleted_at IS NULL`
	args := []interface{}{email}
	argIdx := 2

	if tenantID != nil {
		query += ` AND tenant_id = $` + string(rune('0'+argIdx))
		args = append(args, *tenantID)
		argIdx++
	}

	if excludeID != nil {
		query += ` AND id != $` + string(rune('0'+argIdx))
		args = append(args, *excludeID)
	}
	query += `)`

	var exists bool
	err := r.db.QueryRow(ctx, query, args...).Scan(&exists)
	return exists, err
}

// GetRoleByCode retrieves a role by code
func (r *UserRepository) GetRoleByCode(ctx context.Context, code string) (*user.Role, error) {
	query := `SELECT id, code, name, description FROM roles WHERE code = $1`
	var role user.Role
	err := r.db.QueryRow(ctx, query, code).Scan(&role.ID, &role.Code, &role.Name, &role.Description)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("role not found")
		}
		return nil, err
	}
	return &role, nil
}

// ListByTenant returns all users for a tenant (excluding soft-deleted users).
func (r *UserRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*user.User, error) {
	query := `
		SELECT u.id, u.tenant_id, u.role_id, u.email, u.password_hash, u.name, u.phone, u.avatar_url, u.status,
		       u.email_verified_at, u.last_login_at, u.metadata, u.created_at, u.updated_at, u.deleted_at,
		       r.id, r.code, r.name, r.description
		FROM users u
		JOIN roles r ON u.role_id = r.id
		WHERE u.tenant_id = $1 AND u.deleted_at IS NULL
		ORDER BY u.created_at DESC
	`

	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]*user.User, 0)
	for rows.Next() {
		var u user.User
		var role user.Role
		var deletedAt *time.Time
		err := rows.Scan(
			&u.ID, &u.TenantID, &u.RoleID, &u.Email, &u.PasswordHash, &u.Name, &u.Phone, &u.AvatarURL, &u.Status,
			&u.EmailVerifiedAt, &u.LastLoginAt, &u.Metadata, &u.CreatedAt, &u.UpdatedAt, &deletedAt,
			&role.ID, &role.Code, &role.Name, &role.Description,
		)
		if err != nil {
			return nil, err
		}
		u.DeletedAt = deletedAt
		u.Role = &role
		out = append(out, &u)
	}
	if rows.Err() != nil {
		return nil, rows.Err()
	}
	return out, nil
}












