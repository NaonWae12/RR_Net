package scripts

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func HardDeleteTenants() {
	// Try multiple locations for .env
	cwd, _ := os.Getwd()
	envPaths := []string{
		".env",
		filepath.Join(cwd, ".env"),
		filepath.Join(cwd, "be", ".env"),
	}

	envLoaded := false
	for _, path := range envPaths {
		if err := godotenv.Load(path); err == nil {
			fmt.Printf("Loaded .env from: %s\n", path)
			envLoaded = true
			break
		}
	}

	if !envLoaded {
		log.Println("Warning: Could not load .env from any expected location")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		// Fallback for this specific environment (from previous view_file)
		dbURL = "postgres://rrnet:rrnet_secret@localhost:15432/rrnet_dev?sslmode=disable"
		fmt.Println("Using fallback DATABASE_URL")
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer conn.Close(ctx)

	slugs := []string{"dokkul", "naon-wae"}

	fmt.Printf("Starting hard delete for slugs: %v\n", slugs)

	for _, slug := range slugs {
		fmt.Printf("\n--- Processing slug: %s ---\n", slug)

		// Search for tenants with this slug or mangled slugs
		query := `SELECT id, company_name, slug FROM tenants WHERE slug = $1 OR slug LIKE $2`
		rows, err := conn.Query(ctx, query, slug, slug+"_del_%")
		if err != nil {
			log.Printf("Error searching for tenant %s: %v", slug, err)
			continue
		}

		var ids []string
		for rows.Next() {
			var id, name, actualSlug string
			if err := rows.Scan(&id, &name, &actualSlug); err != nil {
				log.Printf("Error scanning row: %v", err)
				continue
			}
			fmt.Printf("Found Tenant: %s (ID: %s, Slug: %s)\n", name, id, actualSlug)
			ids = append(ids, id)
		}
		rows.Close()

		if len(ids) == 0 {
			fmt.Printf("No tenants found for slug: %s\n", slug)
			continue
		}

		for _, id := range ids {
			fmt.Printf("Deleting data for Tenant ID: %s\n", id)

			// Delete related records first to avoid FK constraints
			// Added more tables based on typical ERP structure
			tables := []string{
				"platform_payments",
				"platform_invoices",
				"client_payslips",
				"clients",
				"users",
				"tenants",
			}

			for _, table := range tables {
				var delQuery string
				if table == "tenants" {
					delQuery = fmt.Sprintf("DELETE FROM %s WHERE id = $1", table)
				} else {
					delQuery = fmt.Sprintf("DELETE FROM %s WHERE tenant_id = $1", table)
				}

				res, err := conn.Exec(ctx, delQuery, id)
				if err != nil {
					// Some tables might not have tenant_id or might not exist, ignore errors gracefully
					log.Printf("  - Info: %s cleanup note: %v", table, err)
				} else {
					fmt.Printf("  - Deleted from %s: %d rows\n", table, res.RowsAffected())
				}
			}
		}
	}

	fmt.Println("\nCleanup finished.")
}
