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

// InstallIsolirFirewall installs the complete isolir firewall setup (idempotent)
// Includes: NAT redirect for HTTP, Filter reject for HTTPS and other traffic
func InstallIsolirFirewall(ctx context.Context, addr string, useTLS bool, username, password, hotspotIP string) error {
	client, err := dialMikroTik(addr, useTLS, username, password)
	if err != nil {
		return err
	}
	defer client.Close()

	// Remove old rules first (idempotent - safe to call multiple times)
	_ = removeIsolirRules(client)

	// 1. Install NAT redirect for HTTP traffic (port 80)
	// This redirects HTTP requests to hotspot error page
	_, err = client.Run(
		"/ip/firewall/nat/add",
		"=chain=dstnat",
		"=src-address-list=isolated",
		"=protocol=tcp",
		"=dst-port=80",
		"=action=dst-nat",
		fmt.Sprintf("=to-addresses=%s", hotspotIP),
		"=to-ports=80",
		"=comment=Isolir-NAT: Redirect HTTP to error page",
	)
	if err != nil {
		return fmt.Errorf("failed to install NAT redirect: %w", err)
	}

	// 2. Install filter to block HTTPS (port 443)
	_, err = client.Run(
		"/ip/firewall/filter/add",
		"=chain=forward",
		"=src-address-list=isolated",
		"=protocol=tcp",
		"=dst-port=443",
		"=action=reject",
		"=reject-with=tcp-reset",
		"=comment=Isolir-Filter: Block HTTPS",
	)
	if err != nil {
		return fmt.Errorf("failed to install HTTPS block: %w", err)
	}

	// 3. Install filter to block all other traffic
	_, err = client.Run(
		"/ip/firewall/filter/add",
		"=chain=forward",
		"=src-address-list=isolated",
		"=action=reject",
		"=reject-with=icmp-network-unreachable",
		"=comment=Isolir-Filter: Block isolated users",
	)
	if err != nil {
		return fmt.Errorf("failed to install general block: %w", err)
	}

	return nil
}

// UninstallIsolirFirewall removes all isolir firewall rules
func UninstallIsolirFirewall(ctx context.Context, addr string, useTLS bool, username, password string) error {
	client, err := dialMikroTik(addr, useTLS, username, password)
	if err != nil {
		return err
	}
	defer client.Close()

	return removeIsolirRules(client)
}

// removeIsolirRules is a helper to remove all rules with "Isolir-" prefix
func removeIsolirRules(client *routeros.Client) error {
	// Remove NAT rules
	natReply, err := client.Run(
		"/ip/firewall/nat/print",
		"?comment~Isolir-",
	)
	if err == nil {
		for _, re := range natReply.Re {
			if id, ok := re.Map[".id"]; ok {
				_, _ = client.Run(
					"/ip/firewall/nat/remove",
					fmt.Sprintf("=.id=%s", id),
				)
			}
		}
	}

	// Remove filter rules
	filterReply, err := client.Run(
		"/ip/firewall/filter/print",
		"?comment~Isolir-",
	)
	if err == nil {
		for _, re := range filterReply.Re {
			if id, ok := re.Map[".id"]; ok {
				_, _ = client.Run(
					"/ip/firewall/filter/remove",
					fmt.Sprintf("=.id=%s", id),
				)
			}
		}
	}

	return nil
}

// IsolirFirewallStatus contains detailed status of isolir firewall setup
type IsolirFirewallStatus struct {
	Installed bool   `json:"installed"`
	RuleCount int    `json:"rule_count"`
	HotspotIP string `json:"hotspot_ip,omitempty"`
	HasNAT    bool   `json:"has_nat"`
	HasFilter bool   `json:"has_filter"`
}

// CheckIsolirFirewall checks if the isolir firewall rules are installed and returns details
func CheckIsolirFirewall(ctx context.Context, addr string, useTLS bool, username, password string) (*IsolirFirewallStatus, error) {
	client, err := dialMikroTik(addr, useTLS, username, password)
	if err != nil {
		return nil, err
	}
	defer client.Close()

	status := &IsolirFirewallStatus{}

	// Check NAT rules
	natReply, err := client.Run(
		"/ip/firewall/nat/print",
		"?comment~Isolir-",
	)
	if err == nil && len(natReply.Re) > 0 {
		status.HasNAT = true
		status.RuleCount += len(natReply.Re)

		// Try to extract hotspot IP from NAT rule
		if toAddr, ok := natReply.Re[0].Map["to-addresses"]; ok {
			status.HotspotIP = toAddr
		}
	}

	// Check filter rules
	filterReply, err := client.Run(
		"/ip/firewall/filter/print",
		"?comment~Isolir-",
	)
	if err == nil && len(filterReply.Re) > 0 {
		status.HasFilter = true
		status.RuleCount += len(filterReply.Re)
	}

	// Installed if we have at least one rule (NAT or Filter)
	status.Installed = status.HasNAT || status.HasFilter

	return status, nil
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
