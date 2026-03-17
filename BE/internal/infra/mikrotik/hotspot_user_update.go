package mikrotik

import (
	"context"
	"fmt"
)

// UpdateHotspotUser updates a Hotspot user on MikroTik router
func UpdateHotspotUser(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, oldName string, user HotspotUser) error {
	client, err := connectToRouterHotspot(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return err
	}
	defer client.Close()

	// Find user by old name
	cmd := "/ip/hotspot/user/print"
	args := []string{
		cmd,
		"?name=" + oldName,
	}

	reply, err := client.RunArgs(args)
	if err != nil {
		return fmt.Errorf("failed to query Hotspot user: %w", err)
	}

	if len(reply.Re) == 0 {
		return fmt.Errorf("Hotspot user not found: %s", oldName)
	}

	userID, ok := reply.Re[0].Map[".id"]
	if !ok {
		return fmt.Errorf("user ID not found in response")
	}

	// Update user
	setCmd := "/ip/hotspot/user/set"
	setArgs := []string{
		setCmd,
		"=.id=" + userID,
	}

	if user.Name != "" {
		setArgs = append(setArgs, "=name="+user.Name)
	}
	if user.Password != "" {
		setArgs = append(setArgs, "=password="+user.Password)
	}
	if user.Profile != "" {
		setArgs = append(setArgs, "=profile="+user.Profile)
	}
	if user.Comment != "" {
		setArgs = append(setArgs, "=comment="+user.Comment)
	}
	if user.SharedUsers > 0 {
		setArgs = append(setArgs, fmt.Sprintf("=limit-shared-users=%d", user.SharedUsers))
	}

	_, err = client.RunArgs(setArgs)
	if err != nil {
		return fmt.Errorf("failed to update Hotspot user: %w", err)
	}

	return nil
}
