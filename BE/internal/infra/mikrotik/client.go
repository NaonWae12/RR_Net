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
func TestLogin(ctx context.Context, addr string, useTLS bool, username string, password string) (*TestResult, error) {
	start := time.Now()

	var client *routeros.Client
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
		return nil, fmt.Errorf("failed to connect/login to Mikrotik API: %w", err)
	}
	defer client.Close()

	// Simple authenticated request to validate session.
	// /system/identity/print returns router identity name.
	_ = ctx // routeros client does not support context in this version; keep signature for future upgrade
	reply, err := client.Run("/system/identity/print")
	if err != nil {
		return nil, fmt.Errorf("connected but failed to run identity query: %w", err)
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
	return res, nil
}
