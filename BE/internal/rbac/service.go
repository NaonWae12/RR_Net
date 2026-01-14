package rbac

import (
	"strings"
)

// Service provides RBAC checking functionality
type Service struct{}

// NewService creates a new RBAC service
func NewService() *Service {
	return &Service{}
}

// HasCapability checks if a role has a specific capability
func (s *Service) HasCapability(role string, capability Capability) bool {
	caps := GetCapabilitiesForRoleString(role)

	for _, cap := range caps {
		// Check for wildcard (super_admin)
		if cap == CapSystemAll {
			return true
		}

		// Exact match
		if cap == capability {
			return true
		}

		// Check for category wildcard (e.g., "user.*" matches "user.create")
		if strings.HasSuffix(string(cap), ".*") {
			prefix := strings.TrimSuffix(string(cap), "*")
			if strings.HasPrefix(string(capability), prefix) {
				return true
			}
		}
	}

	return false
}

// HasAnyCapability checks if a role has any of the specified capabilities
func (s *Service) HasAnyCapability(role string, capabilities ...Capability) bool {
	for _, cap := range capabilities {
		if s.HasCapability(role, cap) {
			return true
		}
	}
	return false
}

// HasAllCapabilities checks if a role has all of the specified capabilities
func (s *Service) HasAllCapabilities(role string, capabilities ...Capability) bool {
	for _, cap := range capabilities {
		if !s.HasCapability(role, cap) {
			return false
		}
	}
	return true
}

// CheckCapability returns an error if the role doesn't have the capability
func (s *Service) CheckCapability(role string, capability Capability) error {
	if !s.HasCapability(role, capability) {
		return ErrForbidden
	}
	return nil
}

// CheckAnyCapability returns an error if the role doesn't have any of the capabilities
func (s *Service) CheckAnyCapability(role string, capabilities ...Capability) error {
	if !s.HasAnyCapability(role, capabilities...) {
		return ErrForbidden
	}
	return nil
}

// CheckAllCapabilities returns an error if the role doesn't have all of the capabilities
func (s *Service) CheckAllCapabilities(role string, capabilities ...Capability) error {
	if !s.HasAllCapabilities(role, capabilities...) {
		return ErrForbidden
	}
	return nil
}

// GetAllCapabilities returns all capabilities for a role
func (s *Service) GetAllCapabilities(role string) []string {
	caps := GetCapabilitiesForRoleString(role)
	result := make([]string, len(caps))
	for i, cap := range caps {
		result[i] = string(cap)
	}
	return result
}






























