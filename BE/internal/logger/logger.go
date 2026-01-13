package logger

import (
	"io"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// Init initializes the global logger with JSON output.
func Init(env string) {
	var output io.Writer = os.Stdout

	// Pretty console output for development
	if env == "development" {
		output = zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
		}
	}

	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = zerolog.New(output).With().Timestamp().Caller().Logger()

	// Set log level based on environment
	switch env {
	case "production":
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	case "development":
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	default:
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}
}

// Get returns the global logger instance.
func Get() *zerolog.Logger {
	return &log.Logger
}

