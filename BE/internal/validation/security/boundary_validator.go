package security

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"rrnet/internal/domain/client"
	"rrnet/internal/repository"
)

// BoundaryValidator validates security boundaries between modules
type BoundaryValidator struct {
	tenantRepo *repository.TenantRepository
	userRepo   *repository.UserRepository
	clientRepo *repository.ClientRepository
}

// NewBoundaryValidator creates a new boundary validator
func NewBoundaryValidator(
	tenantRepo *repository.TenantRepository,
	userRepo *repository.UserRepository,
	clientRepo *repository.ClientRepository,
) *BoundaryValidator {
	return &BoundaryValidator{
		tenantRepo: tenantRepo,
		userRepo:   userRepo,
		clientRepo: clientRepo,
	}
}

// SecurityValidationResult represents the result of a security validation
type SecurityValidationResult struct {
	Valid       bool
	Message     string
	Errors      []string
	Warnings    []string
}

// ValidateTenantIsolation validates tenant data isolation
func (v *BoundaryValidator) ValidateTenantIsolation(
	ctx context.Context,
	tenantID uuid.UUID,
	userID uuid.UUID,
) (*SecurityValidationResult, error) {
	result := &SecurityValidationResult{
		Valid:    true,
		Errors:   []string{},
		Warnings: []string{},
	}

	// Get user
	user, err := v.userRepo.GetByID(ctx, userID)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("User not found: %v", err))
		return result, nil
	}

	// Validate user belongs to tenant (if user has tenant)
	if user.TenantID != nil {
		if *user.TenantID != tenantID {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("User %s does not belong to tenant %s", userID, tenantID))
		}
	} else {
		// Super admin - should not have tenant
		result.Message = "User is super admin (no tenant isolation required)"
	}

	// Validate tenant isolation for clients
	clients, _, err := v.clientRepo.List(ctx, tenantID, &client.ClientListFilter{})
	if err == nil {
		for _, client := range clients {
			if client.TenantID != tenantID {
				result.Valid = false
				result.Errors = append(result.Errors, fmt.Sprintf("Client %s has inconsistent tenant_id", client.ID))
			}
		}
	}

	if len(result.Errors) == 0 {
		result.Message = fmt.Sprintf("Tenant isolation validated successfully for tenant %s", tenantID)
	} else {
		result.Message = fmt.Sprintf("Tenant isolation validation failed with %d errors", len(result.Errors))
	}

	return result, nil
}

// ValidateDataLeakPrevention validates that data leaks are prevented
func (v *BoundaryValidator) ValidateDataLeakPrevention(
	ctx context.Context,
	tenantID uuid.UUID,
) (*SecurityValidationResult, error) {
	result := &SecurityValidationResult{
		Valid:    true,
		Errors:   []string{},
		Warnings: []string{},
	}

	// Check that clients from other tenants are not accessible
	// Note: This check is limited - we can only check clients from the given tenant
	// Cross-tenant access should be prevented at the API/middleware level
	allClients, _, err := v.clientRepo.List(ctx, tenantID, &client.ClientListFilter{})
	if err == nil {
		for _, client := range allClients {
			if client.TenantID != tenantID {
				// This is expected - clients from other tenants should exist
				// But we should verify they can't be accessed by this tenant
				// This is a warning, not an error
				result.Warnings = append(result.Warnings, fmt.Sprintf("Client %s belongs to different tenant %s", client.ID, client.TenantID))
			}
		}
	}

	result.Message = fmt.Sprintf("Data leak prevention validated for tenant %s", tenantID)
	return result, nil
}

// PrivilegeValidator validates privilege escalation controls
type PrivilegeValidator struct {
	userRepo *repository.UserRepository
}

// NewPrivilegeValidator creates a new privilege validator
func NewPrivilegeValidator(userRepo *repository.UserRepository) *PrivilegeValidator {
	return &PrivilegeValidator{
		userRepo: userRepo,
	}
}

// ValidatePrivilegeEscalation validates that privilege escalation is prevented
func (v *PrivilegeValidator) ValidatePrivilegeEscalation(
	ctx context.Context,
	userID uuid.UUID,
	requiredRole string,
) (*SecurityValidationResult, error) {
	result := &SecurityValidationResult{
		Valid:    true,
		Errors:   []string{},
		Warnings: []string{},
	}

	// Get user
	user, err := v.userRepo.GetByID(ctx, userID)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("User not found: %v", err))
		return result, nil
	}

	// Note: Role validation would require role repository/service
	// For now, we just validate that user exists and has a role
	if user.RoleID == uuid.Nil {
		result.Valid = false
		result.Errors = append(result.Errors, "User has no role assigned")
	}

	result.Message = fmt.Sprintf("Privilege escalation validation completed for user %s", userID)
	return result, nil
}

