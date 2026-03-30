package main

import (
	"context"
	"fmt"
	"log"
	"os"

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

	var exists bool
	pool.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM users WHERE email = 'debug@test.com')").Scan(&exists)
	fmt.Printf("User debug@test.com exists: %v\n", exists)

	if exists {
		var uid string
		pool.QueryRow(context.Background(), "SELECT id FROM users WHERE email = 'debug@test.com'").Scan(&uid)
		fmt.Printf("User ID in DB: %s\n", uid)
	}
}
