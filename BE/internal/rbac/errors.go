package rbac

import "errors"

var (
	// ErrForbidden is returned when user doesn't have required capability
	ErrForbidden = errors.New("you do not have permission to perform this action")

	// ErrInvalidRole is returned when role is not recognized
	ErrInvalidRole = errors.New("invalid role")
)





























