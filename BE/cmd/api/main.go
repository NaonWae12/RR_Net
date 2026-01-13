package main

import (
	"context"
	"os"
	"time"

	hibasynq "github.com/hibiken/asynq"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"

	"rrnet/internal/config"
	"rrnet/internal/http/router"
	"rrnet/internal/http/server"
	asynqInfra "rrnet/internal/infra/asynq"
	"rrnet/internal/infra/postgres"
	"rrnet/internal/infra/redis"
	wagw "rrnet/internal/infra/wa_gateway"
	"rrnet/internal/logger"
	"rrnet/internal/repository"
	"rrnet/internal/service"
	"rrnet/internal/worker"
)

func main() {
	// Step 0: Load .env file (if exists, ignore error if not found)
	_ = godotenv.Load()

	// Step 1: Load & validate configuration (fail-fast)
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Step 2: Initialize logger
	logger.Init(cfg.App.Env)

	log.Info().
		Str("app_name", cfg.App.Name).
		Str("app_env", cfg.App.Env).
		Str("port", cfg.App.Port).
		Msg("Starting RRNET backend")

	// Step 3: Initialize infrastructure with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Step 3a: PostgreSQL connection pool
	db, err := postgres.NewPool(ctx, cfg.Database.URL)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to PostgreSQL")
	}
	defer db.Close()
	log.Info().Msg("PostgreSQL connected")

	// Step 3b: Redis client
	redisClient := redis.NewClient(cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB)
	defer redisClient.Close()

	if err := redis.Ping(ctx, redisClient); err != nil {
		log.Warn().Err(err).Msg("Redis connection check failed (non-fatal)")
	} else {
		log.Info().Msg("Redis connected")
	}

	// Step 3c: Asynq client for background jobs
	asynqClient := asynqInfra.NewClient(cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB)
	defer asynqClient.Close()
	log.Info().Msg("Asynq client initialized")

	// Step 3d: Asynq server for background workers (runs alongside HTTP)
	asynqServer := asynqInfra.NewServer(cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB)
	asynqMux := hibasynq.NewServeMux()

	// Register WhatsApp campaign worker
	waCampaignRepo := repository.NewWACampaignRepository(db)
	waLogRepo := repository.NewWALogRepository(db)
	waLogService := service.NewWALogService(waLogRepo)
	waGatewayClient := wagw.NewClient(cfg.WAGateway.URL, cfg.WAGateway.AdminToken)
	tenantLimiter := worker.NewTenantLimiter(1)
	waWorker := worker.NewWACampaignWorker(waCampaignRepo, waGatewayClient, tenantLimiter, waLogService)
	waWorker.Register(asynqMux)

	go func() {
		log.Info().Msg("Asynq worker starting")
		if err := asynqServer.Run(asynqMux); err != nil {
			log.Error().Err(err).Msg("Asynq worker stopped")
		}
	}()

	log.Info().Msg("Infrastructure initialized successfully")

	// Step 4: Setup HTTP router with dependency injection
	handler := router.New(router.Dependencies{
		Config: cfg,
		DB:     db,
		Redis:  redisClient,
		Asynq:  asynqClient,
	})

	// Step 4b: Start lightweight daily invoice scheduler (H-1 before due date)
	tenantRepo := repository.NewTenantRepository(db)
	clientRepo := repository.NewClientRepository(db)
	invoiceRepo := repository.NewInvoiceRepository(db)
	paymentRepo := repository.NewPaymentRepository(db)
	servicePackageRepo := repository.NewServicePackageRepository(db)
	billingService := service.NewBillingService(invoiceRepo, paymentRepo, clientRepo, servicePackageRepo)
	invoiceScheduler := service.NewInvoiceScheduler(tenantRepo, clientRepo, invoiceRepo, billingService)
	invoiceScheduler.StartDailyScheduler(context.Background())

	// Step 4c: Start weekly client cleanup scheduler (hard delete after 28 days)
	cleanupScheduler := service.NewClientCleanupScheduler(
		clientRepo,
		28,          // retentionDays
		time.Monday, // runDay
		"00:10",     // runTime
	)
	cleanupScheduler.StartWeeklyScheduler(context.Background())

	// Step 5: Create and run HTTP server
	srv := server.New(server.Config{
		Port:         cfg.App.Port,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}, handler)

	if err := srv.Run(); err != nil {
		log.Fatal().Err(err).Msg("Server failed")
	}

	os.Exit(0)
}
