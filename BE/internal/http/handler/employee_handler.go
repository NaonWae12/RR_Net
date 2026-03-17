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
	Email      string  `json:"email"`
	Password   string  `json:"password"`
	Name       string  `json:"name"`
	Phone      string  `json:"phone,omitempty"`
	Role       string  `json:"role"` // role code: admin/hr/finance/technician/collector/client
	BaseSalary float64 `json:"base_salary"`
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

		// Skip 'client' role as per user requirement (Employees page is for staff only)
		if roleCode == "client" {
			continue
		}

		out = append(out, &service.UserDTO{
			ID:         u.ID,
			Email:      u.Email,
			Name:       u.Name,
			Phone:      u.Phone,
			AvatarURL:  u.AvatarURL,
			Role:       roleCode,
			TenantID:   u.TenantID,
			BaseSalary: u.BaseSalary,
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
	// - admin/hr can create others (not admin, not owner, not super_admin)
	switch requesterRole {
	case "owner":
		// allow admin/hr/finance/technician/collector/client
	case "admin", "hr":
		if req.Role == "admin" {
			sendError(w, http.StatusForbidden, "Only owner can create/manage admin accounts")
			return
		}
	default:
		sendError(w, http.StatusForbidden, "Only owner/admin/hr can create employees")
		return
	}

	if req.Role == "owner" || req.Role == "super_admin" || req.Role == "client" {
		sendError(w, http.StatusForbidden, "Invalid role for employee creation. Use the Clients page to manage client accounts.")
		return
	}

	dto, err := h.authService.Register(r.Context(), tenantID, req.Role, &service.RegisterRequest{
		Email:      req.Email,
		Password:   req.Password,
		Name:       req.Name,
		Phone:      req.Phone,
		BaseSalary: req.BaseSalary,
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

func (h *EmployeeHandler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid employee ID")
		return
	}

	u, err := h.userRepo.GetByID(r.Context(), id)
	if err != nil {
		sendError(w, http.StatusNotFound, "Employee not found")
		return
	}

	if u.TenantID == nil || *u.TenantID != tenantID {
		sendError(w, http.StatusForbidden, "Unauthorized")
		return
	}

	roleCode := ""
	if u.Role != nil {
		roleCode = u.Role.Code
	}

	dto := &service.UserDTO{
		ID:         u.ID,
		Email:      u.Email,
		Name:       u.Name,
		Phone:      u.Phone,
		AvatarURL:  u.AvatarURL,
		Role:       roleCode,
		TenantID:   u.TenantID,
		BaseSalary: u.BaseSalary,
	}

	sendJSON(w, http.StatusOK, dto)
}

type UpdateEmployeeRequest struct {
	Name       *string  `json:"name,omitempty"`
	Email      *string  `json:"email,omitempty"`
	Phone      *string  `json:"phone,omitempty"`
	Role       *string  `json:"role,omitempty"`
	BaseSalary *float64 `json:"base_salary,omitempty"`
	Password   *string  `json:"password,omitempty"`
}

func (h *EmployeeHandler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid employee ID")
		return
	}

	var req UpdateEmployeeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Fetch existing user to ensure it belongs to the tenant
	u, err := h.userRepo.GetByID(r.Context(), id)
	if err != nil {
		sendError(w, http.StatusNotFound, "Employee not found")
		return
	}

	if u.TenantID == nil || *u.TenantID != tenantID {
		sendError(w, http.StatusForbidden, "Unauthorized: employee belongs to another tenant")
		return
	}

	requesterRole, _ := auth.GetRole(r.Context())
	targetRole := ""
	if u.Role != nil {
		targetRole = u.Role.Code
	}

	// Enforce MVP rules for update:
	// - Only owner can update admins
	// - HR/Admin can update other roles
	if targetRole == "admin" && requesterRole != "owner" {
		sendError(w, http.StatusForbidden, "Only owner can update admin accounts")
		return
	}
	if requesterRole != "owner" && requesterRole != "admin" && requesterRole != "hr" {
		sendError(w, http.StatusForbidden, "Only owner/admin/hr can update employees")
		return
	}

	// Update fields
	if req.Name != nil {
		u.Name = *req.Name
	}
	if req.Email != nil {
		u.Email = *req.Email
	}
	if req.Phone != nil {
		u.Phone = req.Phone
	}
	if req.BaseSalary != nil {
		u.BaseSalary = *req.BaseSalary
	}
	if req.Role != nil {
		role, err := h.userRepo.GetRoleByCode(r.Context(), *req.Role)
		if err != nil {
			sendError(w, http.StatusBadRequest, "Invalid role")
			return
		}
		u.RoleID = role.ID
	}

	if err := h.userRepo.Update(r.Context(), u); err != nil {
		sendError(w, http.StatusInternalServerError, "Failed to update employee")
		return
	}

	if req.Password != nil && *req.Password != "" {
		passwordHash, err := auth.HashPassword(*req.Password)
		if err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to hash password")
			return
		}
		if err := h.userRepo.UpdatePassword(r.Context(), id, passwordHash); err != nil {
			sendError(w, http.StatusInternalServerError, "Failed to update password")
			return
		}
	}

	sendJSON(w, http.StatusOK, map[string]any{
		"message": "Employee updated",
		"user":    u,
	})
}
