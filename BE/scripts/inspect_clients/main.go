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

	rows, _ := pool.Query(context.Background(), `
		SELECT column_name, is_nullable, column_default 
		FROM information_schema.columns 
		WHERE table_name = 'clients'
	`)
	fmt.Println("Clients Table Columns:")
	for rows.Next() {
		var c, n, d interface{}
		rows.Scan(&c, &n, &d)
		fmt.Printf("%-25s | Nullable: %-5v | Default: %v\n", c, n, d)
	}
}
