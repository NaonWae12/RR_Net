package metrics

import (
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics holds all Prometheus metrics
type Metrics struct {
	HTTPRequestsTotal     *prometheus.CounterVec
	HTTPRequestDuration   *prometheus.HistogramVec
	HTTPRequestSize       *prometheus.HistogramVec
	HTTPResponseSize      *prometheus.HistogramVec
	ActiveConnections     prometheus.Gauge
	DatabaseConnections   prometheus.Gauge
	RedisConnections      prometheus.Gauge
	RateLimitHits         *prometheus.CounterVec
	CSRFProtectionHits    *prometheus.CounterVec
}

var (
	// Global metrics instance
	globalMetrics *Metrics
)

// Init initializes Prometheus metrics
func Init() *Metrics {
	if globalMetrics != nil {
		return globalMetrics
	}

	globalMetrics = &Metrics{
		HTTPRequestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "http_requests_total",
				Help: "Total number of HTTP requests",
			},
			[]string{"method", "path", "status", "tenant_id"},
		),
		HTTPRequestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_request_duration_seconds",
				Help:    "HTTP request duration in seconds",
				Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
			},
			[]string{"method", "path", "status"},
		),
		HTTPRequestSize: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_request_size_bytes",
				Help:    "HTTP request size in bytes",
				Buckets: []float64{100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000},
			},
			[]string{"method", "path"},
		),
		HTTPResponseSize: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "http_response_size_bytes",
				Help:    "HTTP response size in bytes",
				Buckets: []float64{100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000},
			},
			[]string{"method", "path", "status"},
		),
		ActiveConnections: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "active_connections",
				Help: "Number of active HTTP connections",
			},
		),
		DatabaseConnections: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "database_connections",
				Help: "Number of active database connections",
			},
		),
		RedisConnections: promauto.NewGauge(
			prometheus.GaugeOpts{
				Name: "redis_connections",
				Help: "Number of active Redis connections",
			},
		),
		RateLimitHits: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "rate_limit_hits_total",
				Help: "Total number of rate limit hits",
			},
			[]string{"endpoint", "client_id"},
		),
		CSRFProtectionHits: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "csrf_protection_hits_total",
				Help: "Total number of CSRF protection hits",
			},
			[]string{"endpoint", "reason"},
		),
	}

	return globalMetrics
}

// Get returns the global metrics instance
func Get() *Metrics {
	if globalMetrics == nil {
		return Init()
	}
	return globalMetrics
}

// RecordHTTPRequest records HTTP request metrics
func (m *Metrics) RecordHTTPRequest(method, path string, status int, duration time.Duration, requestSize, responseSize int64, tenantID string) {
	statusStr := http.StatusText(status)
	if statusStr == "" {
		statusStr = "unknown"
	}

	m.HTTPRequestsTotal.WithLabelValues(method, path, statusStr, tenantID).Inc()
	m.HTTPRequestDuration.WithLabelValues(method, path, statusStr).Observe(duration.Seconds())
	m.HTTPRequestSize.WithLabelValues(method, path).Observe(float64(requestSize))
	m.HTTPResponseSize.WithLabelValues(method, path, statusStr).Observe(float64(responseSize))
}

// RecordRateLimitHit records a rate limit hit
func (m *Metrics) RecordRateLimitHit(endpoint, clientID string) {
	m.RateLimitHits.WithLabelValues(endpoint, clientID).Inc()
}

// RecordCSRFHit records a CSRF protection hit
func (m *Metrics) RecordCSRFHit(endpoint, reason string) {
	m.CSRFProtectionHits.WithLabelValues(endpoint, reason).Inc()
}

// SetActiveConnections sets the number of active connections
func (m *Metrics) SetActiveConnections(count float64) {
	m.ActiveConnections.Set(count)
}

// SetDatabaseConnections sets the number of database connections
func (m *Metrics) SetDatabaseConnections(count float64) {
	m.DatabaseConnections.Set(count)
}

// SetRedisConnections sets the number of Redis connections
func (m *Metrics) SetRedisConnections(count float64) {
	m.RedisConnections.Set(count)
}

// Handler returns the Prometheus metrics handler
func Handler() http.Handler {
	return promhttp.Handler()
}

