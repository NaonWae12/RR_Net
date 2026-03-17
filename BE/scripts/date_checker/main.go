package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

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

	var min, max time.Time
	err = pool.QueryRow(context.Background(), "SELECT MIN(received_at), MAX(received_at) FROM payments").Scan(&min, &max)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Oldest Payment: %s\nNewest Payment: %s\n", min.Format("2006-01-02"), max.Format("2006-01-02"))
}
