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

	// Try one insert with the EXACT parameters and see why it fails
	uID := uuid.New()
	cID := uuid.New()

	// Create User First (Success usually)
	_, err = pool.Exec(context.Background(), `INSERT INTO users (id, tenant_id, email, password_hash, name, role, status) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		uID, tenantID, "debug@test.com", "hash", "Debug User", "client", "active")

	// Check Client Insert
	_, err = pool.Exec(context.Background(), `
		INSERT INTO clients (
			id, tenant_id, user_id, client_code, name, email, phone, address,
			group_id, category, connection_type, router_id, 
			pppoe_username, pppoe_password_enc,
			service_package_id, monthly_fee, 
			status, payment_tempo_option, payment_due_day,
			created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, NOW(), NOW())
	`, cID, tenantID, uID, "DEB-01", "Debug", "debug@test.com", "081", "Addr",
		nil, "regular", "pppoe", nil,
		"user", "pass",
		nil, 100000,
		"active", "default", 1)

	if err != nil {
		fmt.Printf("CLIENT INSERT ERROR: %v\n", err)
	} else {
		fmt.Println("CLIENT INSERT SUCCESS")
	}
}
