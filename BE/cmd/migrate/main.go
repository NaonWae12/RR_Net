package main

import (
	"context"
	"flag"
	"fmt"
	"io/ioutil"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Setup logger
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})

	// Load .env
	godotenv.Load()

	// Flags
	var dbURL string
	var migrationDir string
	flag.StringVar(&dbURL, "url", os.Getenv("DATABASE_URL"), "PostgreSQL Connection URL")
	flag.StringVar(&migrationDir, "dir", "migrations", "Path to migrations directory")
	flag.Parse()

	if dbURL == "" {
		log.Fatal().Msg("DATABASE_URL is required (via flag -url or env)")
	}

	command := flag.Arg(0)
	if command != "up" {
		fmt.Printf("Usage: go run cmd/migrate/main.go [flags] up\n")
		flag.PrintDefaults()
		os.Exit(1)
	}

	// Connect to DB
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer conn.Close(ctx)

	// Ensure migrations table exists
	_, err = conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version BIGINT PRIMARY KEY,
			applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create migrations table")
	}

	// Read migration files
	files, err := ioutil.ReadDir(migrationDir)
	if err != nil {
		log.Fatal().Err(err).Str("dir", migrationDir).Msg("Failed to read migrations directory")
	}

	type migration struct {
		version int64
		name    string
		path    string
	}

	var pendingMigrations []migration
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".up.sql") {
			var version int64
			_, err := fmt.Sscanf(f.Name(), "%06d", &version)
			if err != nil {
				continue
			}

			// Check if already applied
			var exists bool
			err = conn.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)", version).Scan(&exists)
			if err != nil {
				log.Fatal().Err(err).Int64("version", version).Msg("Failed to check migration status")
			}

			if !exists {
				pendingMigrations = append(pendingMigrations, migration{
					version: version,
					name:    f.Name(),
					path:    filepath.Join(migrationDir, f.Name()),
				})
			}
		}
	}

	// Sort by version
	sort.Slice(pendingMigrations, func(i, j int) {
		return pendingMigrations[i].version < pendingMigrations[j].version
	})

	if len(pendingMigrations) == 0 {
		log.Info().Msg("Database is up to date. No pending migrations.")
		return
	}

	// Apply migrations
	for _, m := range pendingMigrations {
		log.Info().Int64("version", m.version).Str("file", m.name).Msg("Applying migration")

		content, err := ioutil.ReadFile(m.path)
		if err != nil {
			log.Fatal().Err(err).Str("file", m.name).Msg("Failed to read migration file")
		}

		tx, err := conn.Begin(ctx)
		if err != nil {
			log.Fatal().Err(err).Msg("Failed to start transaction")
		}

		if _, err := tx.Exec(ctx, string(content)); err != nil {
			tx.Rollback(ctx)
			log.Fatal().Err(err).Str("file", m.name).Msg("Failed to execute migration")
		}

		if _, err := tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", m.version); err != nil {
			tx.Rollback(ctx)
			log.Fatal().Err(err).Int64("version", m.version).Msg("Failed to record migration")
		}

		if err := tx.Commit(ctx); err != nil {
			log.Fatal().Err(err).Msg("Failed to commit transaction")
		}

		log.Info().Int64("version", m.version).Msg("Successfully applied migration")
	}

	log.Info().Int("count", len(pendingMigrations)).Msg("All migrations applied successfully")
}
