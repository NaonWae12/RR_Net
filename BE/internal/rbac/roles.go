package rbac

// Role represents a system role
type Role string

// Predefined system roles per ROLE_CAPABILITY_SPEC
const (
	RoleSuperAdmin Role = "super_admin"
	RoleOwner      Role = "owner"
	RoleAdmin      Role = "admin"
	RoleHR         Role = "hr"
	RoleFinance    Role = "finance"
	RoleTechnician Role = "technician"
	RoleCollector  Role = "collector"
	RoleClient     Role = "client"
)

// AllRoles returns all predefined roles
func AllRoles() []Role {
	return []Role{
		RoleSuperAdmin,
		RoleOwner,
		RoleAdmin,
		RoleHR,
		RoleFinance,
		RoleTechnician,
		RoleCollector,
		RoleClient,
	}
}

// IsValidRole checks if a role string is valid
func IsValidRole(role string) bool {
	for _, r := range AllRoles() {
		if string(r) == role {
			return true
		}
	}
	return false
}

// IsSuperAdmin checks if the role is super_admin
func IsSuperAdmin(role string) bool {
	return role == string(RoleSuperAdmin)
}

// IsTenantAdmin checks if the role has admin-level access within a tenant
func IsTenantAdmin(role string) bool {
	return role == string(RoleOwner) || role == string(RoleAdmin)
}

// String returns the string representation of the role
func (r Role) String() string {
	return string(r)
}






























