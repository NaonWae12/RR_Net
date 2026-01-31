package mikrotik

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"strings"

	"github.com/go-routeros/routeros"
	"github.com/rs/zerolog/log"
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

	// 1. Remove from active sessions
	for _, re := range reply.Re {
		if id, ok := re.Map[".id"]; ok {
			_, _ = client.Run("/ip/hotspot/active/remove", fmt.Sprintf("=.id=%s", id))
		}
	}

	// 2. Remove from cookies to prevent auto-login
	cookieReply, err := client.Run(
		"/ip/hotspot/cookie/print",
		fmt.Sprintf("?user=%s", hotspotUsername),
	)
	if err == nil {
		for _, re := range cookieReply.Re {
			if id, ok := re.Map[".id"]; ok {
				_, _ = client.Run("/ip/hotspot/cookie/remove", fmt.Sprintf("=.id=%s", id))
			}
		}
	}

	return nil
}

// InstallIsolirFirewall installs the complete isolir firewall setup (idempotent)
// Includes: NAT redirect for HTTP, Filter reject for HTTPS and other traffic, and Walled Garden for the portal
func InstallIsolirFirewall(ctx context.Context, addr string, useTLS bool, username, password, hotspotIP, serverHost string) error {
	client, err := dialMikroTik(addr, useTLS, username, password)
	if err != nil {
		return err
	}
	defer client.Close()

	// Remove old rules first (idempotent - safe to call multiple times)
	_ = removeIsolirRules(client)

	// 1. Add to Walled Garden so isolated users can still reach the suspended page
	if serverHost != "" {
		_, err = client.Run(
			"/ip/hotspot/walled-garden/add",
			fmt.Sprintf("=dst-host=%s", serverHost),
			"=action=allow",
			"=comment=Isolir-WP: Allow access to suspended portal",
		)
		if err != nil {
			log.Warn().Err(err).Str("host", serverHost).Msg("Failed to add walled garden entry, continuing...")
		}
	}

	// 2. Install NAT redirect for HTTP traffic (port 80)
	// EXCLUDE serverHost from redirection so they can reach the suspended page
	natArgs := []string{
		"/ip/firewall/nat/add",
		"=chain=dstnat",
		"=src-address-list=isolated",
		"=protocol=tcp",
		"=dst-port=80",
		"=action=dst-nat",
		fmt.Sprintf("=to-addresses=%s", hotspotIP),
		"=to-ports=80",
		"=comment=Isolir-NAT: Redirect HTTP to error page",
	}

	// If serverHost is an IP, exclude it from NAT redirection
	if serverHost != "" && net.ParseIP(serverHost) != nil {
		natArgs = append(natArgs, fmt.Sprintf("=dst-address=!%s", serverHost))
	}

	_, err = client.Run(natArgs...)
	if err != nil {
		return fmt.Errorf("failed to install NAT redirect: %w", err)
	}

	// 3. Install filter to ALLOW access to serverHost (Bypass isolation)
	if serverHost != "" && net.ParseIP(serverHost) != nil {
		_, err = client.Run(
			"/ip/firewall/filter/add",
			"=chain=forward",
			"=src-address-list=isolated",
			fmt.Sprintf("=dst-address=%s", serverHost),
			"=action=accept",
			"=place-before=0",
			"=comment=Isolir-Filter: Allow portal access",
		)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to install filter allow rule, continuing...")
		}
	}

	// 4. Install filter to block HTTPS (port 443)
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

	// 5. Install filter to block all other traffic
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
	// 1. Remove NAT rules
	natReply, err := client.Run("/ip/firewall/nat/print")
	if err == nil {
		for _, re := range natReply.Re {
			comment := re.Map["comment"]
			if strings.Contains(strings.ToLower(comment), "isolir-") {
				if id, ok := re.Map[".id"]; ok {
					_, _ = client.Run("/ip/firewall/nat/remove", fmt.Sprintf("=.id=%s", id))
				}
			}
		}
	}

	// 2. Remove filter rules
	filterReply, err := client.Run("/ip/firewall/filter/print")
	if err == nil {
		for _, re := range filterReply.Re {
			comment := re.Map["comment"]
			if strings.Contains(strings.ToLower(comment), "isolir-") {
				if id, ok := re.Map[".id"]; ok {
					_, _ = client.Run("/ip/firewall/filter/remove", fmt.Sprintf("=.id=%s", id))
				}
			}
		}
	}

	// 3. Remove Walled Garden rules
	wgReply, err := client.Run("/ip/hotspot/walled-garden/print")
	if err == nil {
		for _, re := range wgReply.Re {
			comment := re.Map["comment"]
			if strings.Contains(strings.ToLower(comment), "isolir-") {
				if id, ok := re.Map[".id"]; ok {
					_, _ = client.Run("/ip/hotspot/walled-garden/remove", fmt.Sprintf("=.id=%s", id))
				}
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

	// 1. Check NAT rules (Get all and filter in Go for reliability)
	natReply, err := client.Run("/ip/firewall/nat/print")
	if err == nil {
		for _, re := range natReply.Re {
			comment := re.Map["comment"]
			if strings.Contains(strings.ToLower(comment), "isolir-") {
				status.HasNAT = true
				status.RuleCount++
				if toAddr, ok := re.Map["to-addresses"]; ok {
					status.HotspotIP = toAddr
				}
			}
		}
	}

	// 2. Check Filter rules
	filterReply, err := client.Run("/ip/firewall/filter/print")
	if err == nil {
		for _, re := range filterReply.Re {
			comment := re.Map["comment"]
			if strings.Contains(strings.ToLower(comment), "isolir-") {
				status.HasFilter = true
				status.RuleCount++
			}
		}
	}

	// 3. Check Walled Garden
	wgReply, err := client.Run("/ip/hotspot/walled-garden/print")
	hasWG := false
	if err == nil {
		for _, re := range wgReply.Re {
			comment := re.Map["comment"]
			if strings.Contains(strings.ToLower(comment), "isolir-") {
				hasWG = true
				status.RuleCount++
			}
		}
	}

	// Installed if ANY of our components exist.
	status.Installed = status.HasNAT || status.HasFilter || hasWG

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
