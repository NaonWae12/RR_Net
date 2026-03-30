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
		SELECT column_name 
		FROM information_schema.columns 
		WHERE table_name = 'users'
	`)
	for rows.Next() {
		var c string
		rows.Scan(&c)
		fmt.Println(c)
	}
}
