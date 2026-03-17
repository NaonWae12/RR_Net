package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()

	// 1. Get a Tenant
	var tenantID uuid.UUID
	err = pool.QueryRow(ctx, "SELECT id FROM tenants LIMIT 1").Scan(&tenantID)
	if err != nil {
		log.Fatalf("No tenant found: %v", err)
	}
	fmt.Printf("Using Tenant ID: %s\n", tenantID)

	// 2. Get Role IDs
	var clientRoleID uuid.UUID
	err = pool.QueryRow(ctx, "SELECT id FROM roles WHERE name = 'Client'").Scan(&clientRoleID)
	if err != nil {
		// Try lowercase if not found
		err = pool.QueryRow(ctx, "SELECT id FROM roles WHERE name ILIKE 'client'").Scan(&clientRoleID)
		if err != nil {
			log.Fatalf("Client role not found: %v", err)
		}
	}

	// Clean up old demo data
	fmt.Println("Cleaning up old data...")
	_, _ = pool.Exec(ctx, "DELETE FROM payments WHERE tenant_id = $1", tenantID)
	_, _ = pool.Exec(ctx, "DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = $1)", tenantID)
	_, _ = pool.Exec(ctx, "DELETE FROM invoices WHERE tenant_id = $1", tenantID)

	// Delete users created for clients
	_, _ = pool.Exec(ctx, "DELETE FROM users WHERE tenant_id = $1 AND role_id = $2", tenantID, clientRoleID)

	// Delete all clients for this tenant
	_, _ = pool.Exec(ctx, "DELETE FROM clients WHERE tenant_id = $1", tenantID)

	// 3. Setup Infrastructure (Router & Network Profile)
	var routerID uuid.UUID
	_ = pool.QueryRow(ctx, "SELECT id FROM routers WHERE tenant_id = $1 AND deleted_at IS NULL LIMIT 1", tenantID).Scan(&routerID)
	if routerID == uuid.Nil {
		routerID = uuid.New()
		_, err = pool.Exec(ctx, `
			INSERT INTO routers (
				id, tenant_id, name, description, type, host, status, is_default, radius_enabled, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		`, routerID, tenantID, "Main MikroTik CORE", "Core Router for Seeding", "mikrotik", "10.0.0.1", "online", true, true)
	}

	var networkProfileID uuid.UUID
	_ = pool.QueryRow(ctx, "SELECT id FROM network_profiles WHERE tenant_id = $1 LIMIT 1", tenantID).Scan(&networkProfileID)
	if networkProfileID == uuid.Nil {
		networkProfileID = uuid.New()
		_, err = pool.Exec(ctx, `
			INSERT INTO network_profiles (
				id, tenant_id, name, download_speed, upload_speed, priority, is_active, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		`, networkProfileID, tenantID, "Default Speed 10/10", "10M", "10M", 1, true)
	}

	// 4. Setup Service Packages
	fmt.Println("Setting up service packages...")
	servicePackages := []struct {
		Name     string
		Category string
		Price    int64
	}{
		{"Home Starter 10Mbps", "regular", 150000},
		{"Home Family 20Mbps", "regular", 250000},
		{"Business Pro 50Mbps", "business", 500000},
		{"Business Enterprise 100Mbps", "enterprise", 1200000},
		{"Lite Package 5Mbps", "lite", 100000},
	}

	packageIDs := make(map[string]uuid.UUID)
	for _, p := range servicePackages {
		var pID uuid.UUID
		err = pool.QueryRow(ctx, "SELECT id FROM service_packages WHERE tenant_id = $1 AND name = $2 AND deleted_at IS NULL", tenantID, p.Name).Scan(&pID)
		if err != nil {
			pID = uuid.New()
			_, err = pool.Exec(ctx, `
				INSERT INTO service_packages (
					id, tenant_id, name, category, pricing_model, 
					price_monthly, price_per_device, billing_day_default, 
					network_profile_id, is_active, created_at, updated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
			`, pID, tenantID, p.Name, p.Category, "flat_monthly",
				p.Price, 0, 1,
				networkProfileID, true)
			if err != nil {
				log.Fatalf("Failed to create package %s: %v", p.Name, err)
			}
		}
		packageIDs[p.Name] = pID
	}

	// 5. Setup Client Groups
	fmt.Println("Setting up groups...")
	groups := []string{"Residential Area A", "Business District", "Apartment Complex"}
	groupIds := make([]uuid.UUID, len(groups))
	for i, gName := range groups {
		var gID uuid.UUID
		err = pool.QueryRow(ctx, "SELECT id FROM client_groups WHERE name = $1 AND tenant_id = $2", gName, tenantID).Scan(&gID)
		if err != nil {
			gID = uuid.New()
			_, err = pool.Exec(ctx, "INSERT INTO client_groups (id, tenant_id, name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())", gID, tenantID, gName)
		}
		groupIds[i] = gID
	}

	// 6. Helper function to create User + Client
	passHash := "$2a$12$aGu5KIa5qz77Zl29MPT4Fexbjo..TAFxM4uhbwwLekT57zL1GOaL9." // "password"

	createFullClient := func(code, name, email, phone, addr, cat, connType, pkgName string, gID uuid.UUID) error {
		uID := uuid.New()
		cID := uuid.New()
		pID := packageIDs[pkgName]
		var monthlyFee int64
		for _, sp := range servicePackages {
			if sp.Name == pkgName {
				monthlyFee = sp.Price
				break
			}
		}

		// CREATE USER
		_, err = pool.Exec(ctx, `
			INSERT INTO users (id, tenant_id, email, password_hash, name, role_id, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		`, uID, tenantID, email, passHash, name, clientRoleID, "active")
		if err != nil {
			return fmt.Errorf("user creation failed for %s: %w", email, err)
		}

		// CREATE CLIENT
		_, err = pool.Exec(ctx, `
			INSERT INTO clients (
				id, tenant_id, user_id, client_code, name, email, phone, address,
				group_id, category, connection_type, router_id, 
				pppoe_username, pppoe_password_enc,
				service_package_id, monthly_fee, 
				status, payment_tempo_option, payment_due_day,
				created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW() - INTERVAL '8 months', NOW())
		`, cID, tenantID, uID, code, name, email, phone, addr,
			gID, cat, connType, routerID,
			email, "secret123",
			pID, monthlyFee,
			"active", "default", 1)
		if err != nil {
			return fmt.Errorf("client creation failed for %s: %w", email, err)
		}

		// 7. Create Payment History (Last 6 months)
		for m := 1; m <= 6; m++ {
			monthDate := time.Now().AddDate(0, -m, 0)
			invoiceID := uuid.New()
			invoiceNumber := fmt.Sprintf("INV/%s/%s", code, monthDate.Format("2006/01"))

			periodStart := time.Date(monthDate.Year(), monthDate.Month(), 1, 0, 0, 0, 0, time.Local)
			periodEnd := periodStart.AddDate(0, 1, -1)
			dueDate := periodStart.AddDate(0, 0, 10)

			_, err = pool.Exec(ctx, `
				INSERT INTO invoices (
					id, tenant_id, client_id, invoice_number, total_amount, paid_amount, status, 
					period_start, period_end, due_date, created_at, updated_at, currency, notes, subtotal
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
			`, invoiceID, tenantID, cID, invoiceNumber, monthlyFee, monthlyFee, "paid",
				periodStart, periodEnd, dueDate, periodStart, periodStart, "IDR", "Monthly service", monthlyFee)

			if err != nil {
				continue
			}

			// Add Invoice Item
			_, _ = pool.Exec(ctx, `
				INSERT INTO invoice_items (id, invoice_id, name, quantity, unit_price, total_price)
				VALUES ($1, $2, $3, 1, $4, $4)
			`, uuid.New(), invoiceID, pkgName, monthlyFee)

			paymentID := uuid.New()
			receivedAt := periodStart.AddDate(0, 0, rand.Intn(15))
			_, _ = pool.Exec(ctx, `
				INSERT INTO payments (
					id, tenant_id, invoice_id, client_id, amount, method, received_at, created_at, currency, created_by_user_id
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
			`, paymentID, tenantID, invoiceID, cID, monthlyFee, "cash", receivedAt, receivedAt, "IDR", uID)
		}
		return nil
	}

	// 8. Re-create the user's special clients
	fmt.Println("Restoring specified clients...")
	err = createFullClient("CL-0001", "Client 1", "client1@acme.gmail.com", "0811111111", "Alamat Client 1", "regular", "pppoe", "Home Family 20Mbps", groupIds[0])
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}
	err = createFullClient("CL-0002", "tes1", "tes1@acme.gmail.com", "0822222222", "Alamat tes 1", "regular", "pppoe", "Home Starter 10Mbps", groupIds[0])
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}
	err = createFullClient("CL-0003", "tes2", "client2@acme.test", "0833333333", "Alamat tes 2", "business", "pppoe", "Business Pro 50Mbps", groupIds[1])
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}

	// 9. Create remaining random clients
	fmt.Println("Creating additional random clients...")
	connTypes := []string{"pppoe", "hotspot"}
	for i := 4; i <= 20; i++ {
		code := fmt.Sprintf("CL-%04d", i)
		name := fmt.Sprintf("Random Client %d", i)
		email := fmt.Sprintf("random%d@rrnet.test", i)
		pkg := servicePackages[rand.Intn(len(servicePackages))]
		_ = createFullClient(code, name, email, "0812345678", "Jl. Random No. "+fmt.Sprint(i), pkg.Category, connTypes[rand.Intn(2)], pkg.Name, groupIds[rand.Intn(len(groupIds))])
	}

	fmt.Println("\nSeeding completed! Everyone has a user account and valid package now.")
}
