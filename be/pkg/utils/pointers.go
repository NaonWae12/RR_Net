package utils

// Value returns the value of a pointer or a zero value if the pointer is nil
func Value[T any](ptr *T) T {
	if ptr == nil {
		var zero T
		return zero
	}
	return *ptr
}

// Pointer returns a pointer to the given value
func Pointer[T any](v T) *T {
	return &v
}
