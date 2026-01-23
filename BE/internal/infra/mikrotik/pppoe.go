package mikrotik

import (
	"context"
	"crypto/tls"
	"fmt"
	"strconv"
	"time"

	"github.com/go-routeros/routeros"
)

// PPPoESecret represents a PPPoE secret configuration for MikroTik
type PPPoESecret struct {
	Username      string
	Password      string
	Profile       string
	Service       string
	CallerID      string
	RemoteAddress string
	LocalAddress  string
	Comment       string
	Disabled      bool
}

// ActivePPPoEConnection represents an active PPPoE session
type ActivePPPoEConnection struct {
	ID         string
	Username   string
	Service    string
	CallerID   string
	Address    string
	Uptime     string
	BytesIn    int64
	BytesOut   int64
	PacketsIn  int64
	PacketsOut int64
}

// connectToRouter establishes a connection to MikroTik router
func connectToRouter(ctx context.Context, addr string, useTLS bool, username string, password string) (*routeros.Client, error) {
	timeout := 10 * time.Second
	if ctxTimeout, ok := ctx.Deadline(); ok {
		timeout = time.Until(ctxTimeout)
		if timeout <= 0 {
			return nil, fmt.Errorf("context already expired")
		}
	}

	done := make(chan error, 1)
	var client *routeros.Client

	go func() {
		var err error
		if useTLS {
			tlsCfg := &tls.Config{InsecureSkipVerify: true} //nolint:gosec
			client, err = routeros.DialTLS(addr, username, password, tlsCfg)
		} else {
			client, err = routeros.Dial(addr, username, password)
		}
		done <- err
	}()

	select {
	case err := <-done:
		if err != nil {
			return nil, fmt.Errorf("failed to connect to router: %w", err)
		}
		return client, nil
	case <-time.After(timeout):
		return nil, fmt.Errorf("connection timeout after %v", timeout)
	case <-ctx.Done():
		return nil, fmt.Errorf("context cancelled: %w", ctx.Err())
	}
}

// AddPPPoESecret adds a PPPoE secret to MikroTik router
func AddPPPoESecret(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, secret PPPoESecret) error {
	client, err := connectToRouter(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return err
	}
	defer client.Close()

	cmd := "/ppp/secret/add"
	args := []string{
		cmd,
		"=name=" + secret.Username,
		"=password=" + secret.Password,
	}

	if secret.Profile != "" {
		args = append(args, "=profile="+secret.Profile)
	}
	if secret.Service != "" {
		args = append(args, "=service="+secret.Service)
	} else {
		args = append(args, "=service=pppoe")
	}
	if secret.CallerID != "" {
		args = append(args, "=caller-id="+secret.CallerID)
	}
	if secret.RemoteAddress != "" {
		args = append(args, "=remote-address="+secret.RemoteAddress)
	}
	if secret.LocalAddress != "" {
		args = append(args, "=local-address="+secret.LocalAddress)
	}
	if secret.Comment != "" {
		args = append(args, "=comment="+secret.Comment)
	}
	if secret.Disabled {
		args = append(args, "=disabled=yes")
	} else {
		args = append(args, "=disabled=no")
	}

	_, err = client.RunArgs(args)
	if err != nil {
		return fmt.Errorf("failed to add PPPoE secret: %w", err)
	}

	return nil
}

// UpdatePPPoESecret updates an existing PPPoE secret on MikroTik router
func UpdatePPPoESecret(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, secretID string, secret PPPoESecret) error {
	client, err := connectToRouter(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return err
	}
	defer client.Close()

	cmd := "/ppp/secret/set"
	args := []string{
		cmd,
		"=.id=" + secretID,
	}

	if secret.Username != "" {
		args = append(args, "=name="+secret.Username)
	}
	if secret.Password != "" {
		args = append(args, "=password="+secret.Password)
	}
	if secret.Profile != "" {
		args = append(args, "=profile="+secret.Profile)
	}
	if secret.Service != "" {
		args = append(args, "=service="+secret.Service)
	}
	if secret.CallerID != "" {
		args = append(args, "=caller-id="+secret.CallerID)
	}
	if secret.RemoteAddress != "" {
		args = append(args, "=remote-address="+secret.RemoteAddress)
	}
	if secret.LocalAddress != "" {
		args = append(args, "=local-address="+secret.LocalAddress)
	}
	if secret.Comment != "" {
		args = append(args, "=comment="+secret.Comment)
	}
	if secret.Disabled {
		args = append(args, "=disabled=yes")
	} else {
		args = append(args, "=disabled=no")
	}

	_, err = client.RunArgs(args)
	if err != nil {
		return fmt.Errorf("failed to update PPPoE secret: %w", err)
	}

	return nil
}

// RemovePPPoESecret removes a PPPoE secret from MikroTik router by username
func RemovePPPoESecret(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, username string) error {
	client, err := connectToRouter(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return err
	}
	defer client.Close()

	// First, find the secret by username
	findCmd := "/ppp/secret/print"
	findArgs := []string{
		findCmd,
		"?name=" + username,
	}
	reply, err := client.RunArgs(findArgs)
	if err != nil {
		return fmt.Errorf("failed to find PPPoE secret: %w", err)
	}

	if len(reply.Re) == 0 {
		return fmt.Errorf("PPPoE secret not found: %s", username)
	}

	secretID := reply.Re[0].Map[".id"]
	if secretID == "" {
		return fmt.Errorf("invalid secret ID")
	}

	// Remove the secret
	removeCmd := "/ppp/secret/remove"
	removeArgs := []string{
		removeCmd,
		"=.id=" + secretID,
	}
	_, err = client.RunArgs(removeArgs)
	if err != nil {
		return fmt.Errorf("failed to remove PPPoE secret: %w", err)
	}

	return nil
}

// ListPPPoEActive lists all active PPPoE connections on MikroTik router
func ListPPPoEActive(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string) ([]ActivePPPoEConnection, error) {
	client, err := connectToRouter(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return nil, err
	}
	defer client.Close()

	cmd := "/ppp/active/print"
	reply, err := client.Run(cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to list active PPPoE connections: %w", err)
	}

	var connections []ActivePPPoEConnection
	for _, re := range reply.Re {
		conn := ActivePPPoEConnection{
			ID:       re.Map[".id"],
			Username: re.Map["name"],
			Service:  re.Map["service"],
			CallerID: re.Map["caller-id"],
			Address:  re.Map["address"],
			Uptime:   re.Map["uptime"],
		}

		// Parse numeric fields
		if bytesIn, err := strconv.ParseInt(re.Map["bytes-in"], 10, 64); err == nil {
			conn.BytesIn = bytesIn
		}
		if bytesOut, err := strconv.ParseInt(re.Map["bytes-out"], 10, 64); err == nil {
			conn.BytesOut = bytesOut
		}
		if packetsIn, err := strconv.ParseInt(re.Map["packets-in"], 10, 64); err == nil {
			conn.PacketsIn = packetsIn
		}
		if packetsOut, err := strconv.ParseInt(re.Map["packets-out"], 10, 64); err == nil {
			conn.PacketsOut = packetsOut
		}

		connections = append(connections, conn)
	}

	return connections, nil
}

// DisconnectPPPoE disconnects an active PPPoE session by session ID
func DisconnectPPPoE(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, sessionID string) error {
	client, err := connectToRouter(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return err
	}
	defer client.Close()

	cmd := "/ppp/active/remove"
	args := []string{
		cmd,
		"=.id=" + sessionID,
	}

	_, err = client.RunArgs(args)
	if err != nil {
		return fmt.Errorf("failed to disconnect PPPoE session: %w", err)
	}

	return nil
}

// FindPPPoESecretID finds the MikroTik internal ID of a PPPoE secret by username
func FindPPPoESecretID(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, username string) (string, error) {
	client, err := connectToRouter(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return "", err
	}
	defer client.Close()

	cmd := "/ppp/secret/print"
	args := []string{
		cmd,
		"?name=" + username,
	}
	reply, err := client.RunArgs(args)
	if err != nil {
		return "", fmt.Errorf("failed to find PPPoE secret: %w", err)
	}

	if len(reply.Re) == 0 {
		return "", fmt.Errorf("PPPoE secret not found: %s", username)
	}

	secretID := reply.Re[0].Map[".id"]
	if secretID == "" {
		return "", fmt.Errorf("invalid secret ID")
	}

	return secretID, nil
}

