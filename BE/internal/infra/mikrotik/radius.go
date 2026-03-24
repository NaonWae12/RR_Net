package mikrotik

import (
	"context"
	"fmt"
)

// SetupRadius configures the router to use ERP-NET RADIUS server
func SetupRadius(ctx context.Context, addr string, useTLS bool, username, password string, radiusServerIP string, secret string, nasIdentifier string) error {
	client, err := GetClient(addr, useTLS, username, password)
	if err != nil {
		return err
	}
	defer ReleaseClient(client)

	// 1. Check if RADIUS already exists
	repl, err := client.Run("/radius/print", "?comment=RR-NET")
	if err != nil {
		return fmt.Errorf("failed to check radius: %w", err)
	}

	if len(repl.Re) > 0 {
		// Update existing
		id := repl.Re[0].Map[".id"]
		_, err = client.Run("/radius/set", 
			"=.id="+id, 
			"=address="+radiusServerIP, 
			"=secret="+secret, 
			"=service=hotspot,ppp",
			"=nas-identifier="+nasIdentifier,
		)
	} else {
		// Add new
		_, err = client.Run("/radius/add", 
			"=address="+radiusServerIP, 
			"=secret="+secret, 
			"=service=hotspot,ppp", 
			"=comment=RR-NET",
			"=nas-identifier="+nasIdentifier,
		)
	}
	if err != nil {
		return fmt.Errorf("failed to set radius: %w", err)
	}

	// 2. Enable RADIUS in Hotspot Profile (Default)
	repl, err = client.Run("/ip/hotspot/profile/print", "?default=true")
	if err == nil && len(repl.Re) > 0 {
		id := repl.Re[0].Map[".id"]
		_, _ = client.Run("/ip/hotspot/profile/set", "=.id="+id, "=use-radius=yes")
	}

	// 3. Enable RADIUS in PPP (for PPPoE)
	_, _ = client.Run("/ppp/aaa/set", "=use-radius=yes")

	return nil
}
