package mikrotik

import (
	"context"
	"fmt"
)

// SetupRadius configures the router to use ERP-NET RADIUS server.
//
// NAS identification strategy:
//   - We store nas-identifier directly in the /radius entry (not via /system/identity).
//   - This keeps the router's system identity untouched (operator-owned).
//   - ERP resolves the router via NAS-Identifier sent by FreeRADIUS on every
//     Auth/Acct packet, falling back to NAS-IP-Address.
func SetupRadius(ctx context.Context, addr string, useTLS bool, username, password string, radiusServerIP string, secret string, nasIdentifier string) error {
	client, err := GetClient(addr, useTLS, username, password)
	if err != nil {
		return err
	}
	defer ReleaseClient(client)

	// 1. Check if a RR-NET RADIUS entry already exists (keyed by comment).
	repl, err := client.Run("/radius/print", "?comment=RR-NET")
	if err == nil && repl != nil && len(repl.Re) > 0 && repl.Re[0] != nil && repl.Re[0].Map != nil {
		// Update existing entry (Found by comment)
		id := repl.Re[0].Map[".id"]
		if id == "" {
			return fmt.Errorf("radius: existing entry found by comment but .id is missing")
		}
		args := []string{
			"/radius/set",
			"=.id=" + id,
			"=address=" + radiusServerIP,
			"=secret=" + secret,
			"=service=hotspot,ppp",
		}
		
		// Attempt with nas-identifier first
		fullArgs := append(args, "=nas-identifier="+nasIdentifier)
		if nasIdentifier != "" {
			if _, err = client.Run(fullArgs...); err != nil {
				// Fallback for ROS v7: retry without nas-identifier if property is unknown
				if _, err = client.Run(args...); err != nil {
					return fmt.Errorf("radius: failed to update by comment: %w", err)
				}
			}
		} else {
			if _, err = client.Run(args...); err != nil {
				return fmt.Errorf("radius: failed to update by comment: %w", err)
			}
		}
	} else {
		// Fallback: Check if radius entry with SAME IP already exists (but different comment)
		repl2, err2 := client.Run("/radius/print", "?address="+radiusServerIP)
		if err2 == nil && repl2 != nil && len(repl2.Re) > 0 && repl2.Re[0] != nil && repl2.Re[0].Map != nil {
			// Update the entry by ID
			id := repl2.Re[0].Map[".id"]
			if id == "" {
				return fmt.Errorf("radius: existing entry found by address but .id is missing")
			}
			args := []string{
				"/radius/set",
				"=.id=" + id,
				"=comment=RR-NET",
				"=secret=" + secret,
				"=service=hotspot,ppp",
			}
			
			fullArgs := append(args, "=nas-identifier="+nasIdentifier)
			if nasIdentifier != "" {
				if _, err = client.Run(fullArgs...); err != nil {
					// Fallback for ROS v7
					if _, err = client.Run(args...); err != nil {
						return fmt.Errorf("radius: failed to update by address: %w", err)
					}
				}
			} else {
				if _, err = client.Run(args...); err != nil {
					return fmt.Errorf("radius: failed to update by address: %w", err)
				}
			}
		} else {
			// Add new entry
			args := []string{
				"/radius/add",
				"=address=" + radiusServerIP,
				"=secret=" + secret,
				"=comment=RR-NET",
				"=service=hotspot,ppp",
			}
			
			fullArgs := append(args, "=nas-identifier="+nasIdentifier)
			if nasIdentifier != "" {
				if _, err = client.Run(fullArgs...); err != nil {
					// Fallback for ROS v7
					if _, err = client.Run(args...); err != nil {
						return fmt.Errorf("radius: failed to add new entry: %w", err)
					}
				}
			} else {
				if _, err = client.Run(args...); err != nil {
					return fmt.Errorf("radius: failed to add new entry: %w", err)
				}
			}
		}
	}

	// 2. Enable RADIUS in Hotspot Profile (Default).
	// Silently ignore errors — hotspot may not be configured on this router.
	if replS, errS := client.Run("/ip/hotspot/profile/print", "?default=true"); errS == nil && replS != nil && len(replS.Re) > 0 && replS.Re[0] != nil && replS.Re[0].Map != nil {
		id := replS.Re[0].Map[".id"]
		if id != "" {
			_, _ = client.Run("/ip/hotspot/profile/set", "=.id="+id, "=use-radius=yes")
		}
	}

	// 3. Enable RADIUS in PPP AAA (for PPPoE).
	_, _ = client.Run("/ppp/aaa/set", "=use-radius=yes")

	return nil
}
