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
		SELECT column_name, column_default 
		FROM information_schema.columns 
		WHERE table_name = 'invoices'
	`)
	for rows.Next() {
		var c string
		var d *string
		rows.Scan(&c, &d)
		def := "NONE"
		if d != nil {
			def = *d
		}
		fmt.Printf("%s: %s\n", c, def)
	}
}
