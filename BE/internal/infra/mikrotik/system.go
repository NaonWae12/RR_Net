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

	// 1. Remove L2TP Client
	cleanupResource(client, "/interface/l2tp-client", "name", "l2tp-rrnet")

	// 2. Remove RADIUS Config
	cleanupResourceWithComment(client, "/radius", "RR-NET")

	// 3. Remove Firewall Rules
	cleanupResourceWithComment(client, "/ip/firewall/filter", "Allow ERP Access")

	// 4. Disable RADIUS in Default Hotspot Profile
	hotspotRepl, err := client.Run("/ip/hotspot/profile/print", "?default=true")
	if err == nil && len(hotspotRepl.Re) > 0 {
		for _, re := range hotspotRepl.Re {
			if id, ok := re.Map[".id"]; ok {
				_, _ = client.Run("/ip/hotspot/profile/set", fmt.Sprintf("=.id=%s", id), "=use-radius=no")
			}
		}
	}

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
