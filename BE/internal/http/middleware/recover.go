package middleware

import (
	"net/http"

	"github.com/rs/zerolog/log"
)

// RecoverPanic middleware recovers from panics and logs the error.
func RecoverPanic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Error().
					Str("request_id", GetRequestID(r.Context())).
					Interface("panic", err).
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Msg("Panic recovered")

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"error":"Internal server error"}`))
			}
		}()

		next.ServeHTTP(w, r)
	})
}

