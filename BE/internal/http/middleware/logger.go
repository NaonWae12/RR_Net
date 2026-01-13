package middleware

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"rrnet/internal/metrics"
)

type responseWriter struct {
	http.ResponseWriter
	statusCode int
	written    int64
}

func (rw *responseWriter) WriteHeader(statusCode int) {
	rw.statusCode = statusCode
	rw.ResponseWriter.WriteHeader(statusCode)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.written += int64(n)
	return n, err
}

// RequestLogger middleware logs HTTP requests with structured logging.
func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Wrap response writer to capture status code
		rw := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		next.ServeHTTP(rw, r)

		duration := time.Since(start)

		// Get tenant ID for metrics
		tenantID := "unknown"
		if tid, ok := r.Context().Value("tenant_id").(uuid.UUID); ok && tid != (uuid.UUID{}) {
			tenantID = tid.String()
		}

		// Record Prometheus metrics
		m := metrics.Get()
		if m != nil {
			m.RecordHTTPRequest(
				r.Method,
				r.URL.Path,
				rw.statusCode,
				duration,
				r.ContentLength,
				rw.written,
				tenantID,
			)
		}

		log.Info().
			Str("request_id", GetRequestID(r.Context())).
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Str("remote_addr", r.RemoteAddr).
			Int("status", rw.statusCode).
			Int64("bytes", rw.written).
			Dur("duration_ms", duration).
			Msg("HTTP request")
	})
}

