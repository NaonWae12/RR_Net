package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	dbURL := os.Getenv("DATABASE_URL")
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	var tenantID uuid.UUID
	pool.QueryRow(context.Background(), "SELECT id FROM tenants LIMIT 1").Scan(&tenantID)

	uID := uuid.New()

	// Check User Insert FULL ERROR
	_, err = pool.Exec(context.Background(), `INSERT INTO users (id, tenant_id, email, password_hash, name, role, status) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		uID, tenantID, "debug@test.com", "hash", "Debug User", "client", "active")

	if err != nil {
		fmt.Printf("USER INSERT ERROR: %v\n", err)
	} else {
		fmt.Println("USER INSERT SUCCESS")
	}
}
