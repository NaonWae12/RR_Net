package mikrotik

import (
	"crypto/tls"
	"fmt"
	"sync"
	"time"

	"github.com/go-routeros/routeros"
	"github.com/rs/zerolog/log"
)

var (
	poolMu     sync.Mutex
	clientPool = make(map[string]*mikrotikConnection)
)

type mikrotikConnection struct {
	mu         sync.Mutex // lock for dialing/reconnecting this specific router
	client     *routeros.Client
	lastUsed   time.Time
	addr       string
	useTLS     bool
	username   string
	password   string
}

func getPoolKey(addr, username string) string {
	return fmt.Sprintf("%s|%s", addr, username)
}

// GetClient retrieves an active connection from the pool, establishing a new one if necessary.
// It also checks if the connection is alive with a quick identity print.
func GetClient(addr string, useTLS bool, username, password string) (*routeros.Client, error) {
	key := getPoolKey(addr, username)

	poolMu.Lock()
	conn, exists := clientPool[key]
	
	if !exists {
		// Register early but lock it so others wait until dial completes.
		conn = &mikrotikConnection{
			addr:     addr,
			useTLS:   useTLS,
			username: username,
			password: password,
			lastUsed: time.Now(),
		}
		conn.mu.Lock()
		clientPool[key] = conn
		poolMu.Unlock()
		
		client, err := dialMikroTikRaw(addr, useTLS, username, password)
		if err != nil {
			// Failed: unlock, remove from pool
			conn.mu.Unlock()
			poolMu.Lock()
			delete(clientPool, key)
			poolMu.Unlock()
			return nil, err
		}
		
		conn.client = client
		conn.mu.Unlock()
		return client, nil
	}
	poolMu.Unlock()

	// Wait if another goroutine is currently dialing or reconnecting this router
	conn.mu.Lock()
	client := conn.client
	conn.mu.Unlock()
	
	if client == nil {
		// This happens if the first dialer failed, and we just acquired the lock after it.
		// Or another edge case. Best to force reconnect.
		return nil, fmt.Errorf("mikrotik client is nil")
	}

	// Quick health check
	_, err := client.Run("/system/identity/print")
	if err != nil {
		client.Close()
		
		conn.mu.Lock()
		// Check if another goroutine already fixed it while we were waiting to lock
		if conn.client == client {
			newClient, errDial := dialMikroTikRaw(addr, useTLS, username, password)
			if errDial != nil {
				conn.client = nil
				conn.mu.Unlock()
				ForceReconnect(addr, username)
				return nil, errDial
			}
			conn.client = newClient
			conn.lastUsed = time.Now()
			client = newClient
		} else {
			// Another goroutine fixed it
			client = conn.client
		}
		conn.mu.Unlock()
	}

	conn.mu.Lock()
	conn.lastUsed = time.Now()
	conn.mu.Unlock()

	return client, nil
}

// ReleaseClient is called via defer. For a pool, it does nothing so the connection stays open.
func ReleaseClient(client *routeros.Client) {
	// Do nothing to keep the connection persistent!
}

// dialMikroTikRaw is the low-level connect function
func dialMikroTikRaw(addr string, useTLS bool, username, password string) (*routeros.Client, error) {
	if useTLS {
		tlsCfg := &tls.Config{InsecureSkipVerify: true} //nolint:gosec
		return routeros.DialTLS(addr, username, password, tlsCfg)
	}
	return routeros.Dial(addr, username, password)
}

// ForceReconnect drops the pooled connection and forces a new one (e.g. if we know it's stuck).
func ForceReconnect(addr, username string) {
	key := getPoolKey(addr, username)
	poolMu.Lock()
	defer poolMu.Unlock()
	
	if conn, exists := clientPool[key]; exists {
		if conn.client != nil {
			conn.client.Close()
		}
		delete(clientPool, key)
		log.Info().Str("addr", addr).Str("user", username).Msg("Dropped MikroTik connection from pool")
	}
}
