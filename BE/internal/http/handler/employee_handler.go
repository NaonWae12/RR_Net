package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

// EmployeeHandler provides tenant-scoped employee/user management endpoints.
// MVP rules (per user requirement):
// - Only available if tenant feature `rbac_employee` is enabled (enforced in router via feature gate).
// - Owner can create admin + other roles.
// - Admin can create non-admin roles (hr/finance/technician/collector/client).
type EmployeeHandler struct {
	authService *service.AuthService
	userRepo    *repository.UserRepository
}

func NewEmployeeHandler(authService *service.AuthService, userRepo *repository.UserRepository) *EmployeeHandler {
	return &EmployeeHandler{authService: authService, userRepo: userRepo}
}

type CreateEmployeeRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
	Phone    string `json:"phone,omitempty"`
	Role     string `json:"role"` // role code: admin/hr/finance/technician/collector/client
}

func (h *EmployeeHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	users, err := h.userRepo.ListByTenant(r.Context(), tenantID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to list employees")
		return
	}

	// Map to safe DTOs
	out := make([]*service.UserDTO, 0, len(users))
	for _, u := range users {
		roleCode := ""
		if u.Role != nil {
			roleCode = u.Role.Code
		}
		out = append(out, &service.UserDTO{
			ID:        u.ID,
			Email:     u.Email,
			Name:      u.Name,
			Phone:     u.Phone,
			AvatarURL: u.AvatarURL,
			Role:      roleCode,
			TenantID:  u.TenantID,
		})
	}

	sendJSON(w, http.StatusOK, map[string]any{
		"data":  out,
		"total": len(out),
	})
}

func (h *EmployeeHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	requesterRole, _ := auth.GetRole(r.Context())

	var req CreateEmployeeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Role == "" {
		sendError(w, http.StatusBadRequest, "Role is required")
		return
	}
	if req.Email == "" || req.Password == "" || req.Name == "" {
		sendError(w, http.StatusBadRequest, "Email, password, and name are required")
		return
	}

	// Enforce MVP role creation rules:
	// - owner can create admin + others
	// - admin can create others (not admin, not owner, not super_admin)
	switch requesterRole {
	case "owner":
		// allow admin/hr/finance/technician/collector/client
	case "admin":
		if req.Role == "admin" {
			sendError(w, http.StatusForbidden, "Admin cannot create another admin")
			return
		}
	default:
		sendError(w, http.StatusForbidden, "Only owner/admin can create employees")
		return
	}

	if req.Role == "owner" || req.Role == "super_admin" {
		sendError(w, http.StatusForbidden, "Invalid role")
		return
	}

	dto, err := h.authService.Register(r.Context(), tenantID, req.Role, &service.RegisterRequest{
		Email:    req.Email,
		Password: req.Password,
		Name:     req.Name,
		Phone:    req.Phone,
	})
	if err != nil {
		switch err {
		case repository.ErrEmailTaken:
			sendError(w, http.StatusBadRequest, "Email already taken")
		default:
			sendError(w, http.StatusInternalServerError, "Failed to create employee")
		}
		return
	}

	sendJSON(w, http.StatusCreated, map[string]any{
		"message": "Employee created",
		"user":    dto,
	})
}


