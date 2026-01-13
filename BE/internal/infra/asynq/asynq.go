package asynq

import (
	"github.com/hibiken/asynq"
	"github.com/rs/zerolog/log"
)

// Queue names
const (
	QueueDefault      = "default"
	QueueBilling      = "billing"
	QueueNotification = "notification"
)

// NewClient creates a new Asynq client for enqueuing tasks.
func NewClient(redisAddr, redisPassword string, redisDB int) *asynq.Client {
	client := asynq.NewClient(asynq.RedisClientOpt{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       redisDB,
	})

	log.Info().
		Str("redis_addr", redisAddr).
		Msg("Asynq client initialized")

	return client
}

// NewServer creates a new Asynq server for processing background tasks.
func NewServer(redisAddr, redisPassword string, redisDB int) *asynq.Server {
	srv := asynq.NewServer(
		asynq.RedisClientOpt{
			Addr:     redisAddr,
			Password: redisPassword,
			DB:       redisDB,
		},
		asynq.Config{
			Concurrency: 10,
			Queues: map[string]int{
				QueueDefault:      3,
				QueueBilling:      4,
				QueueNotification: 3,
			},
		},
	)

	log.Info().
		Str("redis_addr", redisAddr).
		Msg("Asynq server initialized")

	return srv
}

// TODO: Worker handlers will be registered in future modules
// Example:
// mux := asynq.NewServeMux()
// mux.HandleFunc("billing:invoice", handleInvoiceTask)
// srv.Run(mux)

