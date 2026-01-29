package mikrotik

import (
	"context"
	"fmt"
)

// HotspotUser represents a Hotspot user configuration for MikroTik
type HotspotUser struct {
	Name     string
	Password string
	Profile  string // Profile name to assign
	Comment  string
}

// AddHotspotUser adds a Hotspot user to MikroTik router
func AddHotspotUser(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, user HotspotUser) error {
	client, err := connectToRouterHotspot(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return err
	}
	defer client.Close()

	cmd := "/ip/hotspot/user/add"
	args := []string{
		cmd,
		"=name=" + user.Name,
	}

	if user.Password != "" {
		args = append(args, "=password="+user.Password)
	}
	if user.Profile != "" {
		args = append(args, "=profile="+user.Profile)
	}
	if user.Comment != "" {
		args = append(args, "=comment="+user.Comment)
	}

	_, err = client.RunArgs(args)
	if err != nil {
		return fmt.Errorf("failed to add Hotspot user: %w", err)
	}

	return nil
}

// FindHotspotUser checks if a Hotspot user exists by name
func FindHotspotUser(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, username string) (bool, error) {
	client, err := connectToRouterHotspot(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return false, err
	}
	defer client.Close()

	cmd := "/ip/hotspot/user/print"
	args := []string{
		cmd,
		"?name=" + username,
	}

	reply, err := client.RunArgs(args)
	if err != nil {
		return false, fmt.Errorf("failed to query Hotspot user: %w", err)
	}

	return len(reply.Re) > 0, nil
}

// RemoveHotspotUser removes a Hotspot user from MikroTik router by name
func RemoveHotspotUser(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, username string) error {
	client, err := connectToRouterHotspot(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return err
	}
	defer client.Close()

	// First, find the user by name
	cmd := "/ip/hotspot/user/print"
	args := []string{
		cmd,
		"?name=" + username,
	}

	reply, err := client.RunArgs(args)
	if err != nil {
		return fmt.Errorf("failed to query Hotspot user: %w", err)
	}

	if len(reply.Re) == 0 {
		return fmt.Errorf("Hotspot user not found: %s", username)
	}

	// Get the .id field from the first result
	userID, ok := reply.Re[0].Map[".id"]
	if !ok {
		return fmt.Errorf("user ID not found in response")
	}

	// Remove the user
	removeCmd := "/ip/hotspot/user/remove"
	removeArgs := []string{
		removeCmd,
		"=.id=" + userID,
	}
	_, err = client.RunArgs(removeArgs)
	if err != nil {
		return fmt.Errorf("failed to remove Hotspot user: %w", err)
	}

	return nil
}
