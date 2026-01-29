package mikrotik

import (
	"context"
	"crypto/tls"
	"fmt"
	"time"

	"github.com/go-routeros/routeros"
)

// connectToRouter establishes a connection to MikroTik router
func connectToRouterHotspot(ctx context.Context, addr string, useTLS bool, username string, password string) (*routeros.Client, error) {
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

// HotspotUserProfile represents a Hotspot user profile configuration for MikroTik
type HotspotUserProfile struct {
	Name        string
	RateLimit   string // Format: "download/upload" e.g., "2048k/1024k"
	AddressList string
	SharedUsers int    // Number of shared users (default: 1)
	Comment     string
}

// AddHotspotUserProfile adds a Hotspot user profile to MikroTik router
func AddHotspotUserProfile(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, profile HotspotUserProfile) error {
	client, err := connectToRouterHotspot(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return err
	}
	defer client.Close()

	cmd := "/ip/hotspot/user/profile/add"
	args := []string{
		cmd,
		"=name=" + profile.Name,
	}

	if profile.RateLimit != "" {
		args = append(args, "=rate-limit="+profile.RateLimit)
	}
	if profile.AddressList != "" {
		args = append(args, "=address-list="+profile.AddressList)
	}
	if profile.SharedUsers > 0 {
		args = append(args, fmt.Sprintf("=shared-users=%d", profile.SharedUsers))
	}
	if profile.Comment != "" {
		args = append(args, "=comment="+profile.Comment)
	}

	_, err = client.RunArgs(args)
	if err != nil {
		return fmt.Errorf("failed to add Hotspot user profile: %w", err)
	}

	return nil
}

// UpdateHotspotUserProfile updates an existing Hotspot user profile on MikroTik router
func UpdateHotspotUserProfile(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, profileID string, profile HotspotUserProfile) error {
	client, err := connectToRouterHotspot(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return err
	}
	defer client.Close()

	cmd := "/ip/hotspot/user/profile/set"
	args := []string{
		cmd,
		"=.id=" + profileID,
	}

	if profile.Name != "" {
		args = append(args, "=name="+profile.Name)
	}
	if profile.RateLimit != "" {
		args = append(args, "=rate-limit="+profile.RateLimit)
	}
	if profile.AddressList != "" {
		args = append(args, "=address-list="+profile.AddressList)
	}
	if profile.SharedUsers > 0 {
		args = append(args, fmt.Sprintf("=shared-users=%d", profile.SharedUsers))
	}
	if profile.Comment != "" {
		args = append(args, "=comment="+profile.Comment)
	}

	_, err = client.RunArgs(args)
	if err != nil {
		return fmt.Errorf("failed to update Hotspot user profile: %w", err)
	}

	return nil
}

// RemoveHotspotUserProfile removes a Hotspot user profile from MikroTik router by name
func RemoveHotspotUserProfile(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, profileName string) error {
	client, err := connectToRouterHotspot(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return err
	}
	defer client.Close()

	// First, find the profile by name
	profileID, err := FindHotspotUserProfileID(ctx, addr, useTLS, routerUsername, routerPassword, profileName)
	if err != nil {
		return err
	}

	// Remove the profile
	cmd := "/ip/hotspot/user/profile/remove"
	args := []string{
		cmd,
		"=.id=" + profileID,
	}
	_, err = client.RunArgs(args)
	if err != nil {
		return fmt.Errorf("failed to remove Hotspot user profile: %w", err)
	}

	return nil
}

// FindHotspotUserProfileID finds the MikroTik internal ID of a Hotspot user profile by name
func FindHotspotUserProfileID(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string, profileName string) (string, error) {
	client, err := connectToRouterHotspot(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return "", err
	}
	defer client.Close()

	cmd := "/ip/hotspot/user/profile/print"
	args := []string{
		cmd,
		"?name=" + profileName,
	}

	reply, err := client.RunArgs(args)
	if err != nil {
		return "", fmt.Errorf("failed to query Hotspot user profile: %w", err)
	}

	if len(reply.Re) == 0 {
		return "", fmt.Errorf("Hotspot user profile not found: %s", profileName)
	}

	// Get the .id field from the first result
	profileID, ok := reply.Re[0].Map[".id"]
	if !ok {
		return "", fmt.Errorf("profile ID not found in response")
	}

	return profileID, nil
}

// ListHotspotUserProfiles lists all Hotspot user profiles from MikroTik router
func ListHotspotUserProfiles(ctx context.Context, addr string, useTLS bool, routerUsername string, routerPassword string) ([]HotspotUserProfile, error) {
	client, err := connectToRouterHotspot(ctx, addr, useTLS, routerUsername, routerPassword)
	if err != nil {
		return nil, err
	}
	defer client.Close()

	cmd := "/ip/hotspot/user/profile/print"
	reply, err := client.Run(cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to list Hotspot user profiles: %w", err)
	}

	var profiles []HotspotUserProfile
	for _, re := range reply.Re {
		profile := HotspotUserProfile{}

		if name, ok := re.Map["name"]; ok {
			profile.Name = name
		}
		if rateLimit, ok := re.Map["rate-limit"]; ok {
			profile.RateLimit = rateLimit
		}
		if addressList, ok := re.Map["address-list"]; ok {
			profile.AddressList = addressList
		}
		if sharedUsersStr, ok := re.Map["shared-users"]; ok && sharedUsersStr != "" {
			var sharedUsersInt int
			if _, err := fmt.Sscanf(sharedUsersStr, "%d", &sharedUsersInt); err == nil {
				profile.SharedUsers = sharedUsersInt
			}
		}
		if comment, ok := re.Map["comment"]; ok {
			profile.Comment = comment
		}

		profiles = append(profiles, profile)
	}

	return profiles, nil
}
