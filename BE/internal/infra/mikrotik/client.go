package mikrotik

import (
	"context"
	"crypto/tls"
	"fmt"
	"time"

	"github.com/go-routeros/routeros"
)

type TestResult struct {
	Identity  string `json:"identity,omitempty"`
	LatencyMS int64  `json:"latency_ms,omitempty"`
}

// TestLogin dials the MikroTik RouterOS API and performs a simple authenticated query.
// NOTE: For TLS (API-SSL), we currently allow self-signed certs (InsecureSkipVerify)
// because many customer routers use self-signed certificates by default.
// Uses a timeout wrapper since routeros.Dial doesn't support context cancellation.
func TestLogin(ctx context.Context, addr string, useTLS bool, username string, password string) (*TestResult, error) {
	start := time.Now()

	// Create a channel to signal completion
	done := make(chan error, 1)
	var client *routeros.Client
	var result *TestResult

	// Set connection timeout (10 seconds)
	timeout := 10 * time.Second
	if ctxTimeout, ok := ctx.Deadline(); ok {
		timeout = time.Until(ctxTimeout)
		if timeout <= 0 {
			return nil, fmt.Errorf("context already expired")
		}
	}

	// Run dial in goroutine with timeout
	go func() {
		var err error
		if useTLS {
			// Best-effort TLS support via library helper.
			// If your RouterOS uses a self-signed cert, this will still work due to InsecureSkipVerify.
			tlsCfg := &tls.Config{InsecureSkipVerify: true} //nolint:gosec
			client, err = routeros.DialTLS(addr, username, password, tlsCfg)
		} else {
			client, err = routeros.Dial(addr, username, password)
		}
		if err != nil {
			done <- fmt.Errorf("failed to connect/login to Mikrotik API: %w", err)
			return
		}
		defer client.Close()

		// Simple authenticated request to validate session.
		// /system/identity/print returns router identity name.
		reply, err := client.Run("/system/identity/print")
		if err != nil {
			done <- fmt.Errorf("connected but failed to run identity query: %w", err)
			return
		}

		res := &TestResult{
			LatencyMS: time.Since(start).Milliseconds(),
		}
		if len(reply.Re) > 0 {
			// Most RouterOS replies include "name" in the first record.
			if name, ok := reply.Re[0].Map["name"]; ok {
				res.Identity = name
			}
		}
		result = res
		done <- nil
	}()

	// Wait for completion or timeout
	select {
	case err := <-done:
		if err != nil {
			return nil, err
		}
		return result, nil
	case <-time.After(timeout):
		return nil, fmt.Errorf("connection timeout after %v: unable to reach %s", timeout, addr)
	case <-ctx.Done():
		return nil, fmt.Errorf("context cancelled: %w", ctx.Err())
	}
}
