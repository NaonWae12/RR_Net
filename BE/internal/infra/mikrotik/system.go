package mikrotik

import (
	"context"
	"fmt"
	"strings"

	"github.com/go-routeros/routeros"
)

// UninstallSystemConfig removes all RR-NET specific configurations from the router
func UninstallSystemConfig(ctx context.Context, addr string, useTLS bool, username, password string) error {
	client, err := dialMikroTik(addr, useTLS, username, password)
	if err != nil {
		return err
	}
	defer client.Close()

	// 1. Remove RADIUS Config
	cleanupResourceWithComment(client, "/radius", "RR-NET")

	// 2. Remove Firewall Rules
	cleanupResourceWithComment(client, "/ip/firewall/filter", "Allow ERP Access")

	// 3. Disable RADIUS in Default Hotspot Profile
	hotspotRepl, err := client.Run("/ip/hotspot/profile/print", "?default=true")
	if err == nil && len(hotspotRepl.Re) > 0 {
		for _, re := range hotspotRepl.Re {
			if id, ok := re.Map[".id"]; ok {
				_, _ = client.Run("/ip/hotspot/profile/set", fmt.Sprintf("=.id=%s", id), "=use-radius=no")
			}
		}
	}

	// 4. Remove L2TP Client (LAST STEP - because it kills the connection)
	cleanupResource(client, "/interface/l2tp-client", "name", "l2tp-rrnet")

	return nil
}

func cleanupResource(client *routeros.Client, path, key, value string) {
	// Use ?key=value for exact matching in RouterOS API
	repl, err := client.Run(path+"/print", "?"+key+"="+value)
	if err != nil {
		return
	}
	for _, re := range repl.Re {
		if id, ok := re.Map[".id"]; ok {
			_, err = client.Run(path+"/remove", "=.id="+id)
			if err != nil {
				fmt.Printf("Warning: Failed to remove %s (.id=%s): %v\n", path, id, err)
			}
		}
	}
}

func cleanupResourceWithComment(client *routeros.Client, path, pattern string) {
	repl, err := client.Run(path + "/print")
	if err != nil {
		return
	}
	for _, re := range repl.Re {
		comment := re.Map["comment"]
		if strings.Contains(strings.ToLower(comment), strings.ToLower(pattern)) {
			if id, ok := re.Map[".id"]; ok {
				_, _ = client.Run(path+"/remove", "=.id="+id)
			}
		}
	}
}
// GetLogs fetches the most recent system logs from the MikroTik router
func GetLogs(ctx context.Context, addr string, useTLS bool, username, password string) ([]map[string]string, error) {
	client, err := dialMikroTik(addr, useTLS, username, password)
	if err != nil {
		return nil, (err)
	}
	defer client.Close()

	// Get last 50 logs for diagnostics
	// We sort by .id descending to get newest first if possible, 
	// but RouterOS usually sends in order of storage. 
	// We'll reverse it if needed in the UI or here.
	repl, err := client.Run("/log/print")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch logs: %w", err)
	}

	var logs []map[string]string
	for _, re := range repl.Re {
		logEntry := map[string]string{
			"time":    re.Map["time"],
			"message": re.Map["message"],
			"topics":  re.Map["topics"],
		}
		logs = append(logs, logEntry)
	}

	// Reverse to get newest first
	for i, j := 0, len(logs)-1; i < j; i, j = i+1, j-1 {
		logs[i], logs[j] = logs[j], logs[i]
	}

	// Limit to 20 for the dashboard
	if len(logs) > 20 {
		logs = logs[:20]
	}

	return logs, nil
}
