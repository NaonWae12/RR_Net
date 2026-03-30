package scripts

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func CheckOAuthUser() {
	godotenv.Load(".env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable"
	}

	ctx := context.Background()
	conn, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Cannot connect: %v", err)
	}
	defer conn.Close()

	email := "dokkul7721@gmail.com"

	var status string
	err = conn.QueryRow(ctx, `SELECT status FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`, email).Scan(&status)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}
	fmt.Printf("User status for %s: %s\n", email, status)
}