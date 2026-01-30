package mikrotik

import (
	"context"
	"crypto/tls"
	"fmt"

	"github.com/go-routeros/routeros"
)

// IsolirConfig holds MikroTik isolir configuration
type IsolirConfig struct {
	AddressListName string // Default: "isolated"
	FirewallChain   string // Default: "forward"
}

// DefaultIsolirConfig returns default isolir configuration
func DefaultIsolirConfig() *IsolirConfig {
	return &IsolirConfig{
		AddressListName: "isolated",
		FirewallChain:   "forward",
	}
}

// AddToIsolatedList adds a user IP to the isolated address-list
func AddToIsolatedList(ctx context.Context, addr string, useTLS bool, username, password, userIP, comment string) error {
	client, err := dialMikroTik(addr, useTLS, username, password)
	if err != nil {
		return err
	}
	defer client.Close()

	// Add IP to address-list "isolated"
	// /ip/firewall/address-list/add list=isolated address=192.168.1.100 comment="voucher:abc123"
	_, err = client.Run(
		"/ip/firewall/address-list/add",
		"=list=isolated",
		fmt.Sprintf("=address=%s", userIP),
		fmt.Sprintf("=comment=%s", comment),
	)
	if err != nil {
		return fmt.Errorf("failed to add IP to isolated list: %w", err)
	}

	return nil
}

// RemoveFromIsolatedList removes a user from the isolated address-list by comment
func RemoveFromIsolatedList(ctx context.Context, addr string, useTLS bool, username, password, comment string) error {
	client, err := dialMikroTik(addr, useTLS, username, password)
	if err != nil {
		return err
	}
	defer client.Close()

	// Find the address-list entry by comment (voucher:CODE)
	reply, err := client.Run(
		"/ip/firewall/address-list/print",
		"?list=isolated",
		fmt.Sprintf("?comment=%s", comment),
	)
	if err != nil {
		return fmt.Errorf("failed to find isolated entry by comment: %w", err)
	}

	// Remove all matching entries
	for _, re := range reply.Re {
		if id, ok := re.Map[".id"]; ok {
			_, err = client.Run(
				"/ip/firewall/address-list/remove",
				fmt.Sprintf("=.id=%s", id),
			)
			if err != nil {
				return fmt.Errorf("failed to remove isolated entry: %w", err)
			}
		}
	}

	return nil
}

// DisconnectHotspotUser disconnects an active Hotspot user by username
func DisconnectHotspotUser(ctx context.Context, addr string, useTLS bool, username, password, hotspotUsername string) error {
	client, err := dialMikroTik(addr, useTLS, username, password)
	if err != nil {
		return err
	}
	defer client.Close()

	// Find active Hotspot session by username
	reply, err := client.Run(
		"/ip/hotspot/active/print",
		fmt.Sprintf("?user=%s", hotspotUsername),
	)
	if err != nil {
		return fmt.Errorf("failed to find hotspot session: %w", err)
	}

	// Remove all matching sessions
	for _, re := range reply.Re {
		if id, ok := re.Map[".id"]; ok {
			_, err = client.Run(
				"/ip/hotspot/active/remove",
				fmt.Sprintf("=.id=%s", id),
			)
			if err != nil {
				return fmt.Errorf("failed to disconnect hotspot user: %w", err)
			}
		}
	}

	return nil
}

// InstallIsolirFirewall installs the firewall rule to block isolated users
func InstallIsolirFirewall(ctx context.Context, addr string, useTLS bool, username, password string) error {
	client, err := dialMikroTik(addr, useTLS, username, password)
	if err != nil {
		return err
	}
	defer client.Close()

	// Check if rule already exists
	reply, err := client.Run(
		"/ip/firewall/filter/print",
		"?chain=forward",
		"?src-address-list=isolated",
	)
	if err != nil {
		return fmt.Errorf("failed to check existing firewall rules: %w", err)
	}

	// If rule already exists, skip
	if len(reply.Re) > 0 {
		return nil // Already installed
	}

	// Add firewall rule to reject traffic from isolated address-list
	// /ip/firewall/filter/add chain=forward src-address-list=isolated action=reject reject-with=icmp-network-unreachable comment="Isolir: Block isolated users"
	_, err = client.Run(
		"/ip/firewall/filter/add",
		"=chain=forward",
		"=src-address-list=isolated",
		"=action=reject",
		"=reject-with=icmp-network-unreachable",
		"=comment=Isolir: Block isolated users",
	)
	if err != nil {
		return fmt.Errorf("failed to install firewall rule: %w", err)
	}

	return nil
}

// CheckIsolirFirewall checks if the isolir firewall rule is installed
func CheckIsolirFirewall(ctx context.Context, addr string, useTLS bool, username, password string) (bool, error) {
	client, err := dialMikroTik(addr, useTLS, username, password)
	if err != nil {
		return false, err
	}
	defer client.Close()

	// Check if rule exists
	reply, err := client.Run(
		"/ip/firewall/filter/print",
		"?chain=forward",
		"?src-address-list=isolated",
	)
	if err != nil {
		return false, fmt.Errorf("failed to check firewall rules: %w", err)
	}

	return len(reply.Re) > 0, nil
}

// GetHotspotUserIP gets the IP address of an active Hotspot user
func GetHotspotUserIP(ctx context.Context, addr string, useTLS bool, username, password, hotspotUsername string) (string, error) {
	client, err := dialMikroTik(addr, useTLS, username, password)
	if err != nil {
		return "", err
	}
	defer client.Close()

	// Find active Hotspot session by username
	reply, err := client.Run(
		"/ip/hotspot/active/print",
		fmt.Sprintf("?user=%s", hotspotUsername),
	)
	if err != nil {
		return "", fmt.Errorf("failed to find hotspot session: %w", err)
	}

	// Get IP from first matching session
	if len(reply.Re) > 0 {
		if ip, ok := reply.Re[0].Map["address"]; ok {
			return ip, nil
		}
	}

	return "", fmt.Errorf("user not found or not active")
}

// dialMikroTik is a helper function to dial MikroTik API
func dialMikroTik(addr string, useTLS bool, username, password string) (*routeros.Client, error) {
	if useTLS {
		tlsCfg := &tls.Config{InsecureSkipVerify: true} //nolint:gosec
		return routeros.DialTLS(addr, username, password, tlsCfg)
	}
	return routeros.Dial(addr, username, password)
}
