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

	fmt.Println("--- Client Detail: client2@acme.test ---")
	var id uuid.UUID
	var name, email string
	var uid, spid *uuid.UUID
	err = pool.QueryRow(context.Background(), "SELECT id, name, email, user_id, service_package_id FROM clients WHERE email = 'client2@acme.test'").Scan(&id, &name, &email, &uid, &spid)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		fmt.Printf("Client ID: %s\n", id)
		fmt.Printf("Name: %s\n", name)
		if uid != nil {
			fmt.Printf("User ID: %s\n", *uid)
			// Check if user exists
			var exists bool
			pool.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)", *uid).Scan(&exists)
			fmt.Printf("User Exists in 'users' table: %v\n", exists)
		} else {
			fmt.Println("User ID: NULL")
		}
		if spid != nil {
			fmt.Printf("Package ID: %s\n", *spid)
			// Check package detail
			var pname string
			pool.QueryRow(context.Background(), "SELECT name FROM service_packages WHERE id = $1", *spid).Scan(&pname)
			fmt.Printf("Package Name: %s\n", pname)
		} else {
			fmt.Println("Package ID: NULL")
		}
	}

	fmt.Println("\n--- Random Seeded Client Check ---")
	err = pool.QueryRow(context.Background(), "SELECT id, name, email, user_id, service_package_id FROM clients WHERE client_code LIKE 'CL-%' LIMIT 1").Scan(&id, &name, &email, &uid, &spid)
	if err == nil {
		fmt.Printf("Seeded Client Email: %s\n", email)
		if uid != nil {
			var uexists bool
			pool.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)", *uid).Scan(&uexists)
			fmt.Printf("Associated User Exists: %v\n", uexists)
		}
	}
}
