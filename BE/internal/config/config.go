package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration
type Config struct {
	App      AppConfig
	Database DatabaseConfig
	Redis    RedisConfig
	Auth     AuthConfig
	Server   ServerConfig
	WAGateway WAGatewayConfig
}

// AppConfig holds application-level settings
type AppConfig struct {
	Name string
	Env  string
	Port string
}

// DatabaseConfig holds PostgreSQL configuration
type DatabaseConfig struct {
	URL          string
	MaxOpenConns int
	MaxIdleConns int
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

// AuthConfig holds authentication configuration
type AuthConfig struct {
	JWTSecret       string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
	MaxRequestSize    int64 // Maximum request body size in bytes
	MaxJSONSize       int64 // Maximum JSON body size in bytes
	MaxMultipartSize  int64 // Maximum multipart form size in bytes
}

// WAGatewayConfig holds WhatsApp gateway integration settings (optional).
type WAGatewayConfig struct {
	URL        string
	AdminToken string
}

// Load reads and validates configuration from environment variables.
// Fails fast if required variables are missing or invalid.
func Load() (*Config, error) {
	cfg := &Config{}

	// App config
	cfg.App.Name = getEnvOrDefault("APP_NAME", "rrnet")
	cfg.App.Env = getEnvOrDefault("APP_ENV", "development")
	cfg.App.Port = getEnvOrDefault("APP_PORT", "8080")

	// Validate port
	port, err := strconv.Atoi(cfg.App.Port)
	if err != nil || port < 1 || port > 65535 {
		return nil, fmt.Errorf("APP_PORT must be a valid port number (1-65535)")
	}

	// Database config
	cfg.Database.URL = os.Getenv("DATABASE_URL")
	if cfg.Database.URL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	// Validate DATABASE_URL format
	if _, err := url.Parse(cfg.Database.URL); err != nil {
		return nil, fmt.Errorf("DATABASE_URL must be a valid URL: %w", err)
	}

	maxOpenConns := getEnvOrDefault("DB_MAX_OPEN_CONNS", "25")
	cfg.Database.MaxOpenConns, err = strconv.Atoi(maxOpenConns)
	if err != nil {
		return nil, fmt.Errorf("DB_MAX_OPEN_CONNS must be an integer: %w", err)
	}

	maxIdleConns := getEnvOrDefault("DB_MAX_IDLE_CONNS", "5")
	cfg.Database.MaxIdleConns, err = strconv.Atoi(maxIdleConns)
	if err != nil {
		return nil, fmt.Errorf("DB_MAX_IDLE_CONNS must be an integer: %w", err)
	}

	// Redis config
	cfg.Redis.Addr = getEnvOrDefault("REDIS_ADDR", "localhost:6379")
	cfg.Redis.Password = getEnvOrDefault("REDIS_PASSWORD", "")

	redisDB := getEnvOrDefault("REDIS_DB", "0")
	cfg.Redis.DB, err = strconv.Atoi(redisDB)
	if err != nil || cfg.Redis.DB < 0 || cfg.Redis.DB > 15 {
		return nil, fmt.Errorf("REDIS_DB must be an integer between 0-15")
	}

	// Auth config
	cfg.Auth.JWTSecret = os.Getenv("JWT_SECRET")
	if cfg.Auth.JWTSecret == "" {
		if cfg.App.Env == "production" {
			return nil, fmt.Errorf("JWT_SECRET is required in production")
		}
		cfg.Auth.JWTSecret = "dev-secret-not-for-production"
	}

	if len(cfg.Auth.JWTSecret) < 32 && cfg.App.Env == "production" {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters in production")
	}

	accessTTL := getEnvOrDefault("JWT_ACCESS_TTL", "15m")
	cfg.Auth.AccessTokenTTL, err = time.ParseDuration(accessTTL)
	if err != nil {
		return nil, fmt.Errorf("JWT_ACCESS_TTL must be a valid duration: %w", err)
	}

	refreshTTL := getEnvOrDefault("JWT_REFRESH_TTL", "7d")
	// Handle "d" suffix for days
	if refreshTTL[len(refreshTTL)-1] == 'd' {
		days, err := strconv.Atoi(refreshTTL[:len(refreshTTL)-1])
		if err != nil {
			return nil, fmt.Errorf("JWT_REFRESH_TTL invalid days format: %w", err)
		}
		cfg.Auth.RefreshTokenTTL = time.Duration(days) * 24 * time.Hour
	} else {
		cfg.Auth.RefreshTokenTTL, err = time.ParseDuration(refreshTTL)
		if err != nil {
			return nil, fmt.Errorf("JWT_REFRESH_TTL must be a valid duration: %w", err)
		}
	}

	// Server config
	readTimeout := getEnvOrDefault("SERVER_READ_TIMEOUT", "15s")
	cfg.Server.ReadTimeout, err = time.ParseDuration(readTimeout)
	if err != nil {
		return nil, fmt.Errorf("SERVER_READ_TIMEOUT must be a valid duration: %w", err)
	}

	writeTimeout := getEnvOrDefault("SERVER_WRITE_TIMEOUT", "15s")
	cfg.Server.WriteTimeout, err = time.ParseDuration(writeTimeout)
	if err != nil {
		return nil, fmt.Errorf("SERVER_WRITE_TIMEOUT must be a valid duration: %w", err)
	}

	idleTimeout := getEnvOrDefault("SERVER_IDLE_TIMEOUT", "60s")
	cfg.Server.IdleTimeout, err = time.ParseDuration(idleTimeout)
	if err != nil {
		return nil, fmt.Errorf("SERVER_IDLE_TIMEOUT must be a valid duration: %w", err)
	}

	// Request size limits
	maxRequestSize := getEnvOrDefault("MAX_REQUEST_SIZE", "10485760") // 10MB default
	cfg.Server.MaxRequestSize, err = strconv.ParseInt(maxRequestSize, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("MAX_REQUEST_SIZE must be an integer: %w", err)
	}

	maxJSONSize := getEnvOrDefault("MAX_JSON_SIZE", "5242880") // 5MB default
	cfg.Server.MaxJSONSize, err = strconv.ParseInt(maxJSONSize, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("MAX_JSON_SIZE must be an integer: %w", err)
	}

	maxMultipartSize := getEnvOrDefault("MAX_MULTIPART_SIZE", "52428800") // 50MB default
	cfg.Server.MaxMultipartSize, err = strconv.ParseInt(maxMultipartSize, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("MAX_MULTIPART_SIZE must be an integer: %w", err)
	}

	// WhatsApp gateway (optional)
	cfg.WAGateway.URL = getEnvOrDefault("WA_GATEWAY_URL", "http://localhost:3001")
	cfg.WAGateway.AdminToken = getEnvOrDefault("WA_GATEWAY_ADMIN_TOKEN", "")
	// Developer convenience: match docker-compose default token when not explicitly set.
	if cfg.WAGateway.AdminToken == "" && cfg.App.Env != "production" {
		cfg.WAGateway.AdminToken = "dev-wa-admin-token"
	}

	return cfg, nil
}

// Backward compatibility aliases
var (
	AppEnv  = func(c *Config) string { return c.App.Env }
	AppName = func(c *Config) string { return c.App.Name }
	AppPort = func(c *Config) string { return c.App.Port }
)

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
