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

	rows, _ := pool.Query(context.Background(), "SELECT id, name FROM roles")
	for rows.Next() {
		var id, name string
		rows.Scan(&id, &name)
		fmt.Printf("Role: %s | ID: %s\n", name, id)
	}
}
