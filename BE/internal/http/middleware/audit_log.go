package middleware

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/repository"
)

// AuditLogger middleware logs requests to audit log
type AuditLogger struct {
	auditRepo *repository.AuditLogRepository
}

// NewAuditLogger creates a new audit logger middleware
func NewAuditLogger(auditRepo *repository.AuditLogRepository) *AuditLogger {
	return &AuditLogger{
		auditRepo: auditRepo,
	}
}

// AuditLogMiddleware returns a middleware that logs requests to audit log
func (al *AuditLogger) AuditLogMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Wrap response writer to capture status code
		rw := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		next.ServeHTTP(rw, r)

		duration := time.Since(start)

		// Get context values
		ctx := r.Context()
		requestID := GetRequestID(ctx)
		tenantID, _ := ctx.Value("tenant_id").(uuid.UUID)
		userID, _ := ctx.Value("user_id").(uuid.UUID)

		// Create audit log entry
		auditLog := &repository.AuditLog{
			ID:         uuid.New(),
			TenantID:   &tenantID,
			UserID:     &userID,
			Action:     r.Method,
			Resource:   r.URL.Path,
			Method:     r.Method,
			Path:       r.URL.Path,
			IPAddress:  r.RemoteAddr,
			UserAgent:  r.UserAgent(),
			RequestID:  requestID,
			Status:     rw.statusCode,
			Duration:   duration,
			Metadata:   make(map[string]interface{}),
			CreatedAt:  time.Now(),
		}

		// Log to audit repository (async to avoid blocking)
		go func() {
			if err := al.auditRepo.Create(r.Context(), auditLog); err != nil {
				log.Error().Err(err).Msg("Failed to create audit log entry")
			}
		}()
	})
}

