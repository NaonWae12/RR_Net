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

	var count int
	pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM invoices WHERE notes IS NULL").Scan(&count)
	fmt.Printf("Invoices with NULL notes: %d\n", count)

	var total int
	pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM invoices").Scan(&total)
	fmt.Printf("Total invoices: %d\n", total)
}
