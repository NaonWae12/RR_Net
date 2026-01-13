package auth

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestHashPassword(t *testing.T) {
	password := "testpassword123"

	hash, err := HashPassword(password)
	require.NoError(t, err)
	assert.NotEmpty(t, hash)
	assert.NotEqual(t, password, hash) // Hash should be different from password

	// Hash should be valid bcrypt hash
	err = bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	assert.NoError(t, err)
}

func TestHashPassword_DifferentHashes(t *testing.T) {
	password := "testpassword123"

	hash1, err := HashPassword(password)
	require.NoError(t, err)

	hash2, err := HashPassword(password)
	require.NoError(t, err)

	// Each hash should be different (due to salt)
	assert.NotEqual(t, hash1, hash2)

	// But both should verify the same password
	err = VerifyPassword(password, hash1)
	assert.NoError(t, err)

	err = VerifyPassword(password, hash2)
	assert.NoError(t, err)
}

func TestVerifyPassword_CorrectPassword(t *testing.T) {
	password := "testpassword123"
	hash, err := HashPassword(password)
	require.NoError(t, err)

	err = VerifyPassword(password, hash)
	assert.NoError(t, err)
}

func TestVerifyPassword_WrongPassword(t *testing.T) {
	password := "testpassword123"
	wrongPassword := "wrongpassword"
	hash, err := HashPassword(password)
	require.NoError(t, err)

	err = VerifyPassword(wrongPassword, hash)
	assert.Error(t, err)
}

func TestValidatePassword_ValidPassword(t *testing.T) {
	validPasswords := []string{
		"password123",
		"Test123456",
		"verylongpassword123",
		"P@ssw0rd!",
	}

	for _, pwd := range validPasswords {
		err := ValidatePassword(pwd)
		assert.NoError(t, err, "Password should be valid: %s", pwd)
	}
}

func TestValidatePassword_InvalidPassword(t *testing.T) {
	invalidPasswords := []string{
		"short",           // Too short
		"1234567",         // Too short
		"",                // Empty
		"abcdefgh",        // No numbers (but might be valid if only length matters)
	}

	for _, pwd := range invalidPasswords {
		err := ValidatePassword(pwd)
		if len(pwd) < 8 {
			assert.Error(t, err, "Password should be invalid (too short): %s", pwd)
		}
	}
}

func TestValidatePassword_MinimumLength(t *testing.T) {
	// Test exactly 8 characters (minimum)
	err := ValidatePassword("12345678")
	assert.NoError(t, err)

	// Test 7 characters (below minimum)
	err = ValidatePassword("1234567")
	assert.Error(t, err)
}

