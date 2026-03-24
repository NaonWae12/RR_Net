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
	client     *routeros.Client
	lastUsed   time.Time
	inUse      bool
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
		// New connection needed, create an entry marked as in-use
		conn = &mikrotikConnection{
			inUse:    true,
			addr:     addr,
			useTLS:   useTLS,
			username: username,
			password: password,
			lastUsed: time.Now(),
		}
		clientPool[key] = conn
		poolMu.Unlock()
		
		client, err := dialMikroTikRaw(addr, useTLS, username, password)
		if err != nil {
			// Failed to connect, remove from pool
			poolMu.Lock()
			delete(clientPool, key)
			poolMu.Unlock()
			return nil, err
		}
		
		conn.client = client
		return client, nil
	}
	
	// If it's already in use by another goroutine, let them wait or we can just dial a new temporary one?
	// But go-routeros clients CAN process concurrent requests if we just use the same client!
	// It uses tags for concurrency underneath. Wait, routeros.Client is safe for concurrent use for *most* things,
	// but the library documentation says "A Client is safe for concurrent use by multiple goroutines."
	// Oh! It IS safe for concurrent use! So we don't need to track `inUse` and block.
	// We just need to ensure we return the same `*routeros.Client` to everyone!
	
	// Wait, let's keep it simple. It's safe for concurrent use.
	
	client := conn.client
	poolMu.Unlock()

	// Quick health check
	_, err := client.Run("/system/identity/print")
	if err != nil {
		// Dead connection. Close and reconnect
		client.Close()
		
		poolMu.Lock()
		// Double check it hasn't been replaced already by another goroutine
		if clientPool[key].client == client {
			newClient, errDial := dialMikroTikRaw(addr, useTLS, username, password)
			if errDial != nil {
				delete(clientPool, key)
				poolMu.Unlock()
				return nil, errDial
			}
			clientPool[key].client = newClient
			clientPool[key].lastUsed = time.Now()
			client = newClient
		} else {
			// Another goroutine fixed it
			client = clientPool[key].client
		}
		poolMu.Unlock()
	}

	poolMu.Lock()
	clientPool[key].lastUsed = time.Now()
	poolMu.Unlock()

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
