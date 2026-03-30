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

	res, err := pool.Exec(context.Background(), "UPDATE invoices SET notes = '' WHERE notes IS NULL")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Updated %d invoices.\n", res.RowsAffected())
}
