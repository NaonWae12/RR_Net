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

	tables := []string{"clients", "users", "invoices", "payments"}
	for _, table := range tables {
		var count int
		err := pool.QueryRow(context.Background(), fmt.Sprintf("SELECT COUNT(*) FROM %s", table)).Scan(&count)
		if err != nil {
			fmt.Printf("Table %s: ERROR %v\n", table, err)
		} else {
			fmt.Printf("Table %s: %d rows\n", table, count)
		}
	}

	// Specifically check user role
	var clientUsers int
	pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'Client'").Scan(&clientUsers)
	fmt.Printf("Users with role 'Client': %d\n", clientUsers)
}
