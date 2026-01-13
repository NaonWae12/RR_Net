package main

import (
	"fmt"
	"os"

	"rrnet/internal/auth"
)

func main() {
	// Generate bcrypt hash for password "password"
	password := "password"
	hash, err := auth.HashPassword(password)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error hashing password: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(hash)
}

