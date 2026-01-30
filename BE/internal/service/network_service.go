package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/domain/network"
	"rrnet/internal/infra/mikrotik"
	"rrnet/internal/repository"
)

type NetworkService struct {
	routerRepo  *repository.RouterRepository
	profileRepo *repository.NetworkProfileRepository
}

func NewNetworkService(
	routerRepo *repository.RouterRepository,
	profileRepo *repository.NetworkProfileRepository,
) *NetworkService {
	return &NetworkService{
		routerRepo:  routerRepo,
		profileRepo: profileRepo,
	}
}

func (s *NetworkService) StartHealthCheckScheduler(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				routers, err := s.routerRepo.ListAll(context.Background())
				if err != nil {
					continue
				}

				for _, r := range routers {
					if r.Type == network.RouterTypeMikroTik && r.Host != "" {
						// Small optimization: only check if not deliberately disconnected
						s.checkAndUpdateStatusAsync(r)
					}
				}
			}
		}
	}()
}

// ========== Router Operations ==========

type CreateRouterRequest struct {
	Name               string                         `json:"name"`
	Description        string                         `json:"description,omitempty"`
	Type               network.RouterType             `json:"type"`
	Host               string                         `json:"host"`
	NASIP              string                         `json:"nas_ip,omitempty"`
	NASIdentifier      string                         `json:"nas_identifier,omitempty"`
	Port               int                            `json:"port"`
	Username           string                         `json:"username"`
	Password           string                         `json:"password"`
	APIPort            int                            `json:"api_port,omitempty"`
	APIUseTLS          *bool                          `json:"api_use_tls,omitempty"`
	ConnectivityMode   network.RouterConnectivityMode `json:"connectivity_mode,omitempty"`
	IsDefault          bool                           `json:"is_default"`
	RadiusEnabled      *bool                          `json:"radius_enabled,omitempty"`
	RadiusSecret       string                         `json:"radius_secret,omitempty"`
	AutoCreateVPN      bool                           `json:"auto_create_vpn"`
	VPNUsername        string                         `json:"vpn_username,omitempty"`
	VPNPassword        string                         `json:"vpn_password,omitempty"`
	VPNScript          string                         `json:"vpn_script,omitempty"`
	RemoteAccessPort   int                            `json:"remote_access_port,omitempty"`
	EnableRemoteAccess bool                           `json:"enable_remote_access"`
}

func (s *NetworkService) CreateRouter(ctx context.Context, tenantID uuid.UUID, req CreateRouterRequest) (*network.Router, error) {
	now := time.Now()
	newID := uuid.New()

	// 0. Enforce Uniqueness of NAS-Identifier (Anti-Duplication)
	// Use provided NASIdentifier or auto-generate UUID if not provided
	// Ensure NASIdentifier is never empty/null
	nasIdentifier := strings.TrimSpace(req.NASIdentifier)
	if nasIdentifier == "" {
		nasIdentifier = newID.String() // Auto-generate if not provided
	}

	// Check uniqueness of the actual NASIdentifier
	if existing, err := s.routerRepo.GetByNASIdentifier(ctx, nasIdentifier); err == nil && existing != nil {
		return nil, fmt.Errorf("NAS-Identifier already exists: %s", nasIdentifier)
	}

	router := &network.Router{
		ID:               newID,
		TenantID:         tenantID,
		Name:             req.Name,
		Description:      req.Description,
		Type:             req.Type,
		Host:             req.Host,
		NASIP:            req.NASIP,
		Port:             req.Port,
		Username:         req.Username,
		Password:         req.Password, // In production, encrypt this
		APIPort:          req.APIPort,
		APIUseTLS:        false,
		ConnectivityMode: req.ConnectivityMode,
		Status:           network.RouterStatusOffline,
		IsDefault:        req.IsDefault,
		RadiusEnabled:    true, // default for MVP
		RadiusSecret:     req.RadiusSecret,
		NASIdentifier:    nasIdentifier,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if router.Port == 0 {
		router.Port = 22
	}
	if req.APIUseTLS != nil {
		router.APIUseTLS = *req.APIUseTLS
	}
	if router.ConnectivityMode == "" {
		router.ConnectivityMode = network.RouterConnectivityModeDirectPublic
	}
	if router.APIPort == 0 {
		if router.APIUseTLS {
			router.APIPort = 8729
		} else {
			router.APIPort = 8728
		}
	}
	if router.Type == "" {
		router.Type = network.RouterTypeMikroTik
	}
	if router.NASIP == "" {
		// For many setups, NAS-IP equals router host (when host is an IP).
		router.NASIP = router.Host
	}
	if req.RadiusEnabled != nil {
		router.RadiusEnabled = *req.RadiusEnabled
	}

	if router.ConnectivityMode == network.RouterConnectivityModeVPN && req.AutoCreateVPN {
		// Use provided credentials if available, otherwise generate
		if req.VPNUsername != "" {
			router.VPNUsername = req.VPNUsername
		} else {
			router.VPNUsername = "vpn-" + strings.ReplaceAll(strings.ToLower(router.Name), " ", "-") + "-" + generateRandomString(4)
		}

		if req.VPNPassword != "" {
			router.VPNPassword = req.VPNPassword
		} else {
			router.VPNPassword = generateRandomString(12)
		}

		if req.RemoteAccessPort > 0 {
			router.RemoteAccessPort = req.RemoteAccessPort
		}

		router.RemoteAccessEnabled = req.EnableRemoteAccess

		// Execute script to add/update VPN user and get IP
		// We call it again in case the user edited credentials in the final step
		cmd := exec.Command("sudo", "/opt/rrnet/scripts/vpn_add_user_auto.sh", router.VPNUsername, router.VPNPassword)
		out, err := cmd.CombinedOutput()
		if err != nil {
			fmt.Printf("Warning: failed to sync VPN account: %v, output: %s\n", err, string(out))
		} else {
			vpnIP := strings.TrimSpace(string(out))
			if net.ParseIP(vpnIP) != nil {
				router.Host = vpnIP
			}
		}
	}

	if req.EnableRemoteAccess {
		// ToggleRemoteAccess logic (port finding part)
		routers, err := s.routerRepo.ListByTenant(ctx, router.TenantID)
		if err != nil {
			return nil, err
		}

		usedPorts := make(map[int]bool)
		for _, r := range routers {
			if r.RemoteAccessPort > 0 {
				usedPorts[r.RemoteAccessPort] = true
			}
		}

		startPort := 10500
		assignedPort := 0
		for p := startPort; p <= 20000; p++ {
			if !usedPorts[p] {
				assignedPort = p
				break
			}
		}
		if assignedPort == 0 {
			return nil, fmt.Errorf("no available ports for remote access")
		}
		router.RemoteAccessPort = assignedPort
		router.RemoteAccessEnabled = true

		// Logic for IPTables will be triggered if Host is set correctly
		if router.Host != "" && runtime.GOOS == "linux" {
			if err := s.applyRemoteAccessRules(router); err != nil {
				return nil, err
			}
		}
	}

	// Generate MikroTik script if VPN was created
	if req.AutoCreateVPN && router.VPNUsername != "" {
		router.VPNScript = s.generateMikrotikVPNScript(router)
	}

	if err := s.routerRepo.Create(ctx, router); err != nil {
		return nil, fmt.Errorf("failed to create router: %w", err)
	}

	// Trigger initial connection check in background
	s.checkAndUpdateStatusAsync(router)

	return router, nil
}

type ProvisionRouterResponse struct {
	RouterID         uuid.UUID `json:"router_id"`
	VPNUsername      string    `json:"vpn_username"`
	VPNPassword      string    `json:"vpn_password"`
	VPNIPsecPSK      string    `json:"vpn_ipsec_psk"`
	VPNScript        string    `json:"vpn_script"`
	RemoteAccessPort int       `json:"remote_access_port"`
	TunnelIP         string    `json:"tunnel_ip"`
	PublicIP         string    `json:"public_ip"`
}

func (s *NetworkService) ProvisionRouter(ctx context.Context, tenantID uuid.UUID, name string) (*ProvisionRouterResponse, error) {
	// 1. Find all used ports and IPs across ALL tenants (important for resource uniqueness)
	// For MVP, we list items in the system.
	// In production, we should have a more efficient way or a global pool table.
	allRouters, err := s.routerRepo.ListAll(ctx) // Need to add ListAll to repository
	if err != nil {
		allRouters = []*network.Router{} // Fallback or handle error
	}

	usedPorts := make(map[int]bool)
	usedIPs := make(map[string]bool)
	for _, r := range allRouters {
		if r.RemoteAccessPort > 0 {
			usedPorts[r.RemoteAccessPort] = true
		}
		if r.Host != "" {
			usedIPs[r.Host] = true
		}
	}

	// 2. Find available port (10500-20000)
	assignedPort := 0
	for p := 10500; p <= 20000; p++ {
		if !usedPorts[p] {
			assignedPort = p
			break
		}
	}
	if assignedPort == 0 {
		return nil, fmt.Errorf("no available ports for remote access")
	}

	// 3. Generate credentials
	vpnUser := "vpn-" + strings.ReplaceAll(strings.ToLower(name), " ", "-") + "-" + generateRandomString(4)
	vpnPass := generateRandomString(12)

	// 4. Execute script to add VPN user on the VPS (strongswan/accel-ppp)
	// The script is responsible for finding the next available IP
	var assignedIP string

	if runtime.GOOS == "windows" {
		// Mock for local development
		fmt.Println("[MOCK-WINDOWS] Executing VPN script skipped. Generating mock IP.")
		// Random IP in range 10.10.10.100-250
		b := make([]byte, 1)
		_, _ = rand.Read(b)
		octet := int(b[0])%150 + 100
		assignedIP = fmt.Sprintf("10.10.10.%d", octet)
	} else {
		cmd := exec.Command("sudo", "/opt/rrnet/scripts/vpn_add_user_auto.sh", vpnUser, vpnPass)
		out, err := cmd.CombinedOutput()
		if err != nil {
			fmt.Printf("Warning: failed to create VPN account during provision: %v, output: %s\n", err, string(out))
			// If script fails, we can't get an IP, so we might return error or fallback
			return nil, fmt.Errorf("failed to create vpn user: %s", string(out))
		}

		// 5. Read assigned IP from script output
		assignedIP = strings.TrimSpace(string(out))
		if net.ParseIP(assignedIP) == nil {
			return nil, fmt.Errorf("script returned invalid IP: %s", assignedIP)
		}
	}

	// 6. Create Router object and SAVE to database immediately as "provisioning"
	now := time.Now()
	newID := uuid.New()
	router := &network.Router{
		ID:                  newID,
		TenantID:            tenantID,
		Name:                name,
		Type:                network.RouterTypeMikroTik,
		ConnectivityMode:    network.RouterConnectivityModeVPN,
		Status:              network.RouterStatusProvisioning,
		VPNUsername:         vpnUser,
		VPNPassword:         vpnPass,
		Host:                assignedIP,
		RemoteAccessPort:    assignedPort,
		RemoteAccessEnabled: true,
		NASIdentifier:       newID.String(),
		CreatedAt:           now,
		UpdatedAt:           now,
	}

	// Generate script for this router
	script := s.generateMikrotikVPNScript(router)
	router.VPNScript = script

	if err := s.routerRepo.Create(ctx, router); err != nil {
		return nil, fmt.Errorf("failed to pre-save provisioning router: %w", err)
	}

	publicIP := s.getPublicIP()
	psk := s.getIPsecPSK()

	return &ProvisionRouterResponse{
		RouterID:         router.ID,
		VPNUsername:      vpnUser,
		VPNPassword:      vpnPass,
		VPNIPsecPSK:      psk,
		VPNScript:        script,
		RemoteAccessPort: assignedPort,
		TunnelIP:         assignedIP,
		PublicIP:         publicIP,
	}, nil
}

func (s *NetworkService) getPublicIP() string {
	// 1. Check ENV
	if ip := os.Getenv("PUBLIC_IP"); ip != "" {
		return ip
	}

	// 2. Try to auto-detect (HTTP request to checkip.amazonaws.com)
	// We use a short timeout
	client := http.Client{
		Timeout: 2 * time.Second,
	}
	resp, err := client.Get("https://checkip.amazonaws.com")
	if err == nil {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		ip := strings.TrimSpace(string(body))
		if net.ParseIP(ip) != nil {
			return ip
		}
	}

	// 3. Fallback to hardcoded if all fails (your current VPS)
	return "72.60.74.209"
}

func (s *NetworkService) GetRouter(ctx context.Context, id uuid.UUID) (*network.Router, error) {
	return s.routerRepo.GetByID(ctx, id)
}

func (s *NetworkService) ListRouters(ctx context.Context, tenantID uuid.UUID) ([]*network.Router, error) {
	return s.routerRepo.ListByTenant(ctx, tenantID)
}

func (s *NetworkService) GetDefaultRouter(ctx context.Context, tenantID uuid.UUID) (*network.Router, error) {
	return s.routerRepo.GetDefaultByTenant(ctx, tenantID)
}

type UpdateRouterRequest struct {
	Name               string                         `json:"name,omitempty"`
	Description        string                         `json:"description,omitempty"`
	Type               network.RouterType             `json:"type,omitempty"`
	Host               string                         `json:"host,omitempty"`
	NASIP              string                         `json:"nas_ip,omitempty"`
	Port               int                            `json:"port,omitempty"`
	Username           string                         `json:"username,omitempty"`
	Password           string                         `json:"password,omitempty"`
	APIPort            int                            `json:"api_port,omitempty"`
	APIUseTLS          *bool                          `json:"api_use_tls,omitempty"`
	ConnectivityMode   network.RouterConnectivityMode `json:"connectivity_mode,omitempty"`
	IsDefault          bool                           `json:"is_default"`
	RadiusEnabled      *bool                          `json:"radius_enabled,omitempty"`
	RadiusSecret       string                         `json:"radius_secret,omitempty"`
	VPNUsername        string                         `json:"vpn_username,omitempty"`
	VPNPassword        string                         `json:"vpn_password,omitempty"`
	VPNScript          string                         `json:"vpn_script,omitempty"`
	RemoteAccessPort   int                            `json:"remote_access_port,omitempty"`
	EnableRemoteAccess *bool                          `json:"enable_remote_access,omitempty"`
}

func (s *NetworkService) UpdateRouter(ctx context.Context, id uuid.UUID, req UpdateRouterRequest) (*network.Router, error) {
	router, err := s.routerRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.Name != "" {
		router.Name = req.Name
	}
	if req.Description != "" {
		router.Description = req.Description
	}
	if req.Type != "" {
		router.Type = req.Type
	}
	if req.Host != "" {
		router.Host = req.Host
	}
	if req.NASIP != "" {
		router.NASIP = req.NASIP
	}
	if req.Port > 0 {
		router.Port = req.Port
	}
	if req.Username != "" {
		router.Username = req.Username
	}
	if req.Password != "" {
		router.Password = req.Password
	}
	if req.APIPort > 0 {
		router.APIPort = req.APIPort
	}
	if req.APIUseTLS != nil {
		router.APIUseTLS = *req.APIUseTLS
	}
	if req.ConnectivityMode != "" {
		router.ConnectivityMode = req.ConnectivityMode
	}
	if req.RadiusEnabled != nil {
		router.RadiusEnabled = *req.RadiusEnabled
	}
	if req.RadiusSecret != "" {
		router.RadiusSecret = req.RadiusSecret
	}
	if req.VPNUsername != "" {
		router.VPNUsername = req.VPNUsername
	}
	if req.VPNPassword != "" {
		router.VPNPassword = req.VPNPassword
	}
	if req.VPNScript != "" {
		router.VPNScript = req.VPNScript
	}
	if req.RemoteAccessPort > 0 {
		router.RemoteAccessPort = req.RemoteAccessPort
	}
	if req.EnableRemoteAccess != nil {
		router.RemoteAccessEnabled = *req.EnableRemoteAccess
	}
	router.IsDefault = req.IsDefault
	router.UpdatedAt = time.Now()

	// Check if we need to update Remote Access rules (Port Forwarding)
	// Apply rules if:
	// 1. Remote Access is enabled (either newly enabled or existing)
	// 2. Connectivity Mode is VPN (rules only apply for VPN clients in this context)
	// 3. We have a Host IP and a Remote Access Port
	shouldApplyRules := (router.RemoteAccessEnabled) &&
		(router.ConnectivityMode == network.RouterConnectivityModeVPN) &&
		(router.Host != "") &&
		(router.RemoteAccessPort > 0)

	// If remote access was toggled OFF in this request
	if req.EnableRemoteAccess != nil && !*req.EnableRemoteAccess {
		// Cleanup rules
		_ = s.removeRemoteAccessRules(router)
		shouldApplyRules = false
	}

	if shouldApplyRules && runtime.GOOS == "linux" {
		// We re-apply rules here to ensure they are up to date with any port/IP changes
		// Ideally we should check if they changed, but re-applying (delete then add) is safer
		_ = s.removeRemoteAccessRules(router) // Cleanup old rules just in case
		if err := s.applyRemoteAccessRules(router); err != nil {
			fmt.Printf("Warning: failed to apply remote access rules on update: %v\n", err)
			// Non-fatal, we still save the DB update
		}
	}

	if err := s.routerRepo.Update(ctx, router); err != nil {
		return nil, fmt.Errorf("failed to update router: %w", err)
	}

	// Trigger connection check in background after update
	s.checkAndUpdateStatusAsync(router)

	return router, nil
}

func (s *NetworkService) DeleteRouter(ctx context.Context, id uuid.UUID) error {
	return s.routerRepo.Delete(ctx, id)
}

func (s *NetworkService) CountRouters(ctx context.Context, tenantID uuid.UUID) (int, error) {
	return s.routerRepo.CountByTenant(ctx, tenantID)
}

func (s *NetworkService) ListAllRouters(ctx context.Context) ([]*network.Router, error) {
	return s.routerRepo.ListAll(ctx)
}

func (s *NetworkService) UpdateRouterStatus(ctx context.Context, id uuid.UUID, status network.RouterStatus) error {
	return s.routerRepo.UpdateStatus(ctx, id, status)
}

type RouterConnectionTestResult struct {
	OK        bool   `json:"ok"`
	Identity  string `json:"identity,omitempty"`
	LatencyMS int64  `json:"latency_ms,omitempty"`
}

func (s *NetworkService) TestRouterConnection(ctx context.Context, router *network.Router) (*RouterConnectionTestResult, error) {
	if router == nil {
		return nil, fmt.Errorf("router is required")
	}
	if router.Type != network.RouterTypeMikroTik {
		return nil, fmt.Errorf("connection test is only supported for mikrotik routers")
	}
	if router.Host == "" {
		return nil, fmt.Errorf("router host is empty")
	}
	if router.Username == "" {
		return nil, fmt.Errorf("router username is empty")
	}
	if router.Password == "" {
		return nil, fmt.Errorf("router password is not set (update router password first)")
	}
	if router.APIPort <= 0 {
		return nil, fmt.Errorf("router api_port is invalid")
	}

	addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
	out, err := mikrotik.TestLogin(ctx, addr, router.APIUseTLS, router.Username, router.Password)
	if err != nil {
		// Connection failed, mark as offline
		_ = s.routerRepo.UpdateStatus(ctx, router.ID, network.RouterStatusOffline)
		return nil, err
	}

	// Connection successful, mark as online
	if err := s.routerRepo.UpdateStatus(ctx, router.ID, network.RouterStatusOnline); err != nil {
		return nil, fmt.Errorf("connection successful but failed to update status: %w", err)
	}

	return &RouterConnectionTestResult{
		OK:        true,
		Identity:  out.Identity,
		LatencyMS: out.LatencyMS,
	}, nil
}

func (s *NetworkService) DisconnectRouter(ctx context.Context, id uuid.UUID) error {
	// For now, we just update the status to offline.
	// In the future, if we have persistent connections/streams, we would close them here.
	if err := s.routerRepo.UpdateStatus(ctx, id, network.RouterStatusOffline); err != nil {
		return fmt.Errorf("failed to update router status to offline: %w", err)
	}
	return nil
}

// TestRouterConfigRequest is used for testing connection with temporary config (before saving)
type TestRouterConfigRequest struct {
	Type      network.RouterType `json:"type"`
	Host      string             `json:"host"`
	APIPort   int                `json:"api_port"`
	APIUseTLS bool               `json:"api_use_tls"`
	Username  string             `json:"username"`
	Password  string             `json:"password"`
}

func (s *NetworkService) TestRouterConfig(ctx context.Context, req TestRouterConfigRequest) (*RouterConnectionTestResult, error) {
	if req.Type != network.RouterTypeMikroTik {
		return nil, fmt.Errorf("connection test is only supported for mikrotik routers")
	}
	if req.Host == "" {
		return nil, fmt.Errorf("host is required")
	}
	if req.Username == "" {
		return nil, fmt.Errorf("username is required")
	}
	if req.Password == "" {
		return nil, fmt.Errorf("password is required")
	}

	apiPort := req.APIPort
	if apiPort <= 0 {
		if req.APIUseTLS {
			apiPort = 8729
		} else {
			apiPort = 8728
		}
	}

	addr := net.JoinHostPort(req.Host, strconv.Itoa(apiPort))
	out, err := mikrotik.TestLogin(ctx, addr, req.APIUseTLS, req.Username, req.Password)
	if err != nil {
		return nil, err
	}

	return &RouterConnectionTestResult{
		OK:        true,
		Identity:  out.Identity,
		LatencyMS: out.LatencyMS,
	}, nil
}

func (s *NetworkService) checkAndUpdateStatusAsync(router *network.Router) {
	go func() {
		// Create a detached context with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_, _ = s.TestRouterConnection(ctx, router)
	}()
}

// ========== Network Profile Operations ==========

type CreateProfileRequest struct {
	Name          string `json:"name"`
	Description   string `json:"description,omitempty"`
	DownloadSpeed int    `json:"download_speed"` // Kbps
	UploadSpeed   int    `json:"upload_speed"`   // Kbps
	BurstDownload int    `json:"burst_download,omitempty"`
	BurstUpload   int    `json:"burst_upload,omitempty"`
	Priority      int    `json:"priority,omitempty"`
	SharedUsers   int    `json:"shared_users,omitempty"`
	AddressPool   string `json:"address_pool,omitempty"`
	DNSServers    string `json:"dns_servers,omitempty"`
}

func (s *NetworkService) CreateProfile(ctx context.Context, tenantID uuid.UUID, req CreateProfileRequest) (*network.NetworkProfile, error) {
	now := time.Now()
	profile := &network.NetworkProfile{
		ID:            uuid.New(),
		TenantID:      tenantID,
		Name:          req.Name,
		DownloadSpeed: req.DownloadSpeed,
		UploadSpeed:   req.UploadSpeed,
		BurstDownload: req.BurstDownload,
		BurstUpload:   req.BurstUpload,
		Priority:      req.Priority,
		SharedUsers:   req.SharedUsers,
		IsActive:      true,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	// Handle nullable string fields
	if req.Description != "" {
		profile.Description = &req.Description
	}
	if req.AddressPool != "" {
		profile.AddressPool = &req.AddressPool
	}
	if req.DNSServers != "" {
		profile.DNSServers = &req.DNSServers
	}

	if profile.Priority == 0 {
		profile.Priority = 8
	}
	if profile.SharedUsers == 0 {
		profile.SharedUsers = 1
	}

	if err := s.profileRepo.Create(ctx, profile); err != nil {
		return nil, fmt.Errorf("failed to create profile: %w", err)
	}

	log.Info().
		Str("tenant_id", tenantID.String()).
		Str("profile_id", profile.ID.String()).
		Str("profile_name", profile.Name).
		Int("download_speed", profile.DownloadSpeed).
		Int("upload_speed", profile.UploadSpeed).
		Msg("Network Service: Profile created successfully")

	// Auto-sync profile to all tenant routers (non-blocking)
	// This ensures profile exists on routers before it can be used
	go func() {
		syncCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		log.Info().
			Str("tenant_id", tenantID.String()).
			Str("profile_id", profile.ID.String()).
			Str("profile_name", profile.Name).
			Msg("Network Service: Starting auto-sync profile to routers")

		routers, err := s.routerRepo.ListByTenant(syncCtx, tenantID)
		if err != nil {
			log.Error().
				Str("tenant_id", tenantID.String()).
				Str("profile_id", profile.ID.String()).
				Str("profile_name", profile.Name).
				Err(err).
				Msg("Network Service: Failed to list routers for auto-sync")
			return
		}

		log.Info().
			Str("tenant_id", tenantID.String()).
			Str("profile_id", profile.ID.String()).
			Str("profile_name", profile.Name).
			Int("router_count", len(routers)).
			Msg("Network Service: Found routers for auto-sync")

		syncedCount := 0
		failedCount := 0

		for _, router := range routers {
			if router.Type != network.RouterTypeMikroTik {
				log.Debug().
					Str("tenant_id", tenantID.String()).
					Str("profile_id", profile.ID.String()).
					Str("router_id", router.ID.String()).
					Str("router_name", router.Name).
					Str("router_type", string(router.Type)).
					Msg("Network Service: Skipping non-MikroTik router for auto-sync")
				continue
			}

			if router.Host == "" {
				log.Debug().
					Str("tenant_id", tenantID.String()).
					Str("profile_id", profile.ID.String()).
					Str("router_id", router.ID.String()).
					Str("router_name", router.Name).
					Msg("Network Service: Skipping router with empty host for auto-sync")
				continue
			}

			log.Info().
				Str("tenant_id", tenantID.String()).
				Str("profile_id", profile.ID.String()).
				Str("profile_name", profile.Name).
				Str("router_id", router.ID.String()).
				Str("router_name", router.Name).
				Str("router_host", router.Host).
				Int("router_port", router.APIPort).
				Bool("router_tls", router.APIUseTLS).
				Msg("Network Service: Auto-syncing profile to router")

			if err := s.SyncProfileToRouter(syncCtx, profile.ID, router.ID); err != nil {
				failedCount++
				log.Error().
					Str("tenant_id", tenantID.String()).
					Str("profile_id", profile.ID.String()).
					Str("profile_name", profile.Name).
					Str("router_id", router.ID.String()).
					Str("router_name", router.Name).
					Str("router_host", router.Host).
					Int("router_port", router.APIPort).
					Err(err).
					Msg("Network Service: Failed to auto-sync profile to router")
			} else {
				syncedCount++
				log.Info().
					Str("tenant_id", tenantID.String()).
					Str("profile_id", profile.ID.String()).
					Str("profile_name", profile.Name).
					Str("router_id", router.ID.String()).
					Str("router_name", router.Name).
					Str("router_host", router.Host).
					Msg("Network Service: Successfully auto-synced profile to router")
			}
		}

		log.Info().
			Str("tenant_id", tenantID.String()).
			Str("profile_id", profile.ID.String()).
			Str("profile_name", profile.Name).
			Int("synced_count", syncedCount).
			Int("failed_count", failedCount).
			Int("total_routers", len(routers)).
			Msg("Network Service: Auto-sync profile to routers completed")
	}()

	return profile, nil
}

func (s *NetworkService) GetProfile(ctx context.Context, id uuid.UUID) (*network.NetworkProfile, error) {
	return s.profileRepo.GetByID(ctx, id)
}

func (s *NetworkService) ListProfiles(ctx context.Context, tenantID uuid.UUID, activeOnly bool) ([]*network.NetworkProfile, error) {
	return s.profileRepo.ListByTenant(ctx, tenantID, activeOnly)
}

type UpdateProfileRequest struct {
	Name          string `json:"name,omitempty"`
	Description   string `json:"description,omitempty"`
	DownloadSpeed int    `json:"download_speed,omitempty"`
	UploadSpeed   int    `json:"upload_speed,omitempty"`
	BurstDownload int    `json:"burst_download,omitempty"`
	BurstUpload   int    `json:"burst_upload,omitempty"`
	Priority      int    `json:"priority,omitempty"`
	SharedUsers   int    `json:"shared_users,omitempty"`
	AddressPool   string `json:"address_pool,omitempty"`
	DNSServers    string `json:"dns_servers,omitempty"`
	IsActive      *bool  `json:"is_active,omitempty"`
}

func (s *NetworkService) UpdateProfile(ctx context.Context, id uuid.UUID, req UpdateProfileRequest) (*network.NetworkProfile, error) {
	profile, err := s.profileRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.Name != "" {
		profile.Name = req.Name
	}
	if req.Description != "" {
		profile.Description = &req.Description
	}
	if req.DownloadSpeed > 0 {
		profile.DownloadSpeed = req.DownloadSpeed
	}
	if req.UploadSpeed > 0 {
		profile.UploadSpeed = req.UploadSpeed
	}
	if req.BurstDownload > 0 {
		profile.BurstDownload = req.BurstDownload
	}
	if req.BurstUpload > 0 {
		profile.BurstUpload = req.BurstUpload
	}
	if req.Priority > 0 {
		profile.Priority = req.Priority
	}
	if req.SharedUsers > 0 {
		profile.SharedUsers = req.SharedUsers
	}
	if req.AddressPool != "" {
		profile.AddressPool = &req.AddressPool
	}
	if req.DNSServers != "" {
		profile.DNSServers = &req.DNSServers
	}
	if req.IsActive != nil {
		profile.IsActive = *req.IsActive
	}
	profile.UpdatedAt = time.Now()

	if err := s.profileRepo.Update(ctx, profile); err != nil {
		return nil, fmt.Errorf("failed to update profile: %w", err)
	}

	return profile, nil
}

func (s *NetworkService) DeleteProfile(ctx context.Context, id uuid.UUID) error {
	return s.profileRepo.Delete(ctx, id)
}

// SyncProfileToRouter syncs a network profile to MikroTik router
// This ensures the profile exists on the router before it can be used in PPPoE secrets
func (s *NetworkService) SyncProfileToRouter(ctx context.Context, profileID uuid.UUID, routerID uuid.UUID) error {
	// Get profile
	profile, err := s.profileRepo.GetByID(ctx, profileID)
	if err != nil {
		log.Error().
			Str("profile_id", profileID.String()).
			Str("router_id", routerID.String()).
			Err(err).
			Msg("Network Service: Profile not found for sync")
		return fmt.Errorf("profile not found: %w", err)
	}

	// Get router
	router, err := s.routerRepo.GetByID(ctx, routerID)
	if err != nil {
		log.Error().
			Str("profile_id", profileID.String()).
			Str("router_id", routerID.String()).
			Err(err).
			Msg("Network Service: Router not found for sync")
		return fmt.Errorf("router not found: %w", err)
	}
	if router.Type != network.RouterTypeMikroTik {
		log.Warn().
			Str("profile_id", profileID.String()).
			Str("router_id", routerID.String()).
			Str("router_type", string(router.Type)).
			Msg("Network Service: Only MikroTik routers are supported for sync")
		return fmt.Errorf("only MikroTik routers are supported")
	}

	log.Info().
		Str("profile_id", profileID.String()).
		Str("profile_name", profile.Name).
		Str("router_id", routerID.String()).
		Str("router_name", router.Name).
		Str("router_host", router.Host).
		Int("router_port", router.APIPort).
		Bool("router_tls", router.APIUseTLS).
		Msg("Network Service: Starting sync profile to router")

	// Convert to MikroTik profile format
	mikrotikProfile := convertToMikrotikProfile(profile)

	log.Debug().
		Str("profile_id", profileID.String()).
		Str("profile_name", profile.Name).
		Str("router_id", routerID.String()).
		Str("router_name", router.Name).
		Str("mikrotik_profile_name", mikrotikProfile.Name).
		Str("mikrotik_rate_limit", mikrotikProfile.RateLimit).
		Str("mikrotik_local_address", mikrotikProfile.LocalAddress).
		Str("mikrotik_remote_address", mikrotikProfile.RemoteAddress).
		Bool("mikrotik_only_one", mikrotikProfile.OnlyOne).
		Msg("Network Service: Converted profile to MikroTik format")

	// Connect and sync
	addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))

	log.Debug().
		Str("profile_id", profileID.String()).
		Str("router_id", routerID.String()).
		Str("router_address", addr).
		Msg("Network Service: Checking if profile exists on router")

	// Check if profile exists on router
	_, err = mikrotik.FindPPPoEProfileID(ctx, addr, router.APIUseTLS, router.Username, router.Password, profile.Name)
	if err != nil {
		// Profile doesn't exist, create it
		log.Info().
			Str("profile_id", profileID.String()).
			Str("profile_name", profile.Name).
			Str("router_id", routerID.String()).
			Str("router_name", router.Name).
			Str("router_address", addr).
			Msg("Network Service: Profile not found on router, creating new profile")

		if err := mikrotik.AddPPPoEProfile(ctx, addr, router.APIUseTLS, router.Username, router.Password, mikrotikProfile); err != nil {
			log.Error().
				Str("profile_id", profileID.String()).
				Str("profile_name", profile.Name).
				Str("router_id", routerID.String()).
				Str("router_name", router.Name).
				Str("router_address", addr).
				Err(err).
				Msg("Network Service: Failed to create profile on router")
			return fmt.Errorf("failed to create profile on router: %w", err)
		}

		log.Info().
			Str("profile_id", profileID.String()).
			Str("profile_name", profile.Name).
			Str("router_id", routerID.String()).
			Str("router_name", router.Name).
			Msg("Network Service: Successfully created profile on router")
		return nil
	}

	// Profile exists, update it
	log.Info().
		Str("profile_id", profileID.String()).
		Str("profile_name", profile.Name).
		Str("router_id", routerID.String()).
		Str("router_name", router.Name).
		Str("router_address", addr).
		Msg("Network Service: Profile exists on router, updating profile")

	profileIDStr, err := mikrotik.FindPPPoEProfileID(ctx, addr, router.APIUseTLS, router.Username, router.Password, profile.Name)
	if err != nil {
		log.Error().
			Str("profile_id", profileID.String()).
			Str("profile_name", profile.Name).
			Str("router_id", routerID.String()).
			Str("router_name", router.Name).
			Str("router_address", addr).
			Err(err).
			Msg("Network Service: Failed to find profile ID on router")
		return fmt.Errorf("failed to find profile on router: %w", err)
	}

	log.Debug().
		Str("profile_id", profileID.String()).
		Str("profile_name", profile.Name).
		Str("router_id", routerID.String()).
		Str("mikrotik_profile_id", profileIDStr).
		Msg("Network Service: Found profile ID on router, updating")

	if err := mikrotik.UpdatePPPoEProfile(ctx, addr, router.APIUseTLS, router.Username, router.Password, profileIDStr, mikrotikProfile); err != nil {
		log.Error().
			Str("profile_id", profileID.String()).
			Str("profile_name", profile.Name).
			Str("router_id", routerID.String()).
			Str("router_name", router.Name).
			Str("router_address", addr).
			Str("mikrotik_profile_id", profileIDStr).
			Err(err).
			Msg("Network Service: Failed to update profile on router")
		return fmt.Errorf("failed to update profile on router: %w", err)
	}

	log.Info().
		Str("profile_id", profileID.String()).
		Str("profile_name", profile.Name).
		Str("router_id", routerID.String()).
		Str("router_name", router.Name).
		Msg("Network Service: Successfully updated profile on router")

	return nil
}

// ListProfilesFromRouter lists all PPPoE profiles from a MikroTik router
func (s *NetworkService) ListProfilesFromRouter(ctx context.Context, routerID uuid.UUID) ([]mikrotik.PPPoEProfile, error) {
	// Get router
	router, err := s.routerRepo.GetByID(ctx, routerID)
	if err != nil {
		return nil, fmt.Errorf("router not found: %w", err)
	}
	if router.Type != network.RouterTypeMikroTik {
		return nil, fmt.Errorf("only MikroTik routers are supported")
	}

	// Connect and list profiles
	addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
	profiles, err := mikrotik.ListPPPoEProfiles(ctx, addr, router.APIUseTLS, router.Username, router.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to list profiles from router: %w", err)
	}

	return profiles, nil
}

// ImportProfileFromRouter imports a PPPoE profile from MikroTik router and creates it in ERP
func (s *NetworkService) ImportProfileFromRouter(ctx context.Context, tenantID uuid.UUID, routerID uuid.UUID, profileName string) (*network.NetworkProfile, error) {
	// Get router
	router, err := s.routerRepo.GetByID(ctx, routerID)
	if err != nil {
		return nil, fmt.Errorf("router not found: %w", err)
	}
	if router.TenantID != tenantID {
		return nil, fmt.Errorf("router not found")
	}
	if router.Type != network.RouterTypeMikroTik {
		return nil, fmt.Errorf("only MikroTik routers are supported")
	}

	// Get profile from router
	addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
	mikrotikProfiles, err := mikrotik.ListPPPoEProfiles(ctx, addr, router.APIUseTLS, router.Username, router.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to list profiles from router: %w", err)
	}

	// Find the profile by name
	var mikrotikProfile *mikrotik.PPPoEProfile
	for i := range mikrotikProfiles {
		if mikrotikProfiles[i].Name == profileName {
			mikrotikProfile = &mikrotikProfiles[i]
			break
		}
	}

	if mikrotikProfile == nil {
		return nil, fmt.Errorf("profile '%s' not found on router", profileName)
	}

	// Convert MikroTik profile to NetworkProfile
	profile := convertFromMikrotikProfile(tenantID, mikrotikProfile)

	// Check if profile with same name already exists
	existingProfiles, err := s.profileRepo.ListByTenant(ctx, tenantID, false)
	if err == nil {
		for _, p := range existingProfiles {
			if p.Name == profile.Name {
				return nil, fmt.Errorf("profile with name '%s' already exists", profile.Name)
			}
		}
	}

	// Create profile in database
	if err := s.profileRepo.Create(ctx, profile); err != nil {
		return nil, fmt.Errorf("failed to create profile: %w", err)
	}

	return profile, nil
}

// convertFromMikrotikProfile converts MikroTik PPPoEProfile to NetworkProfile
func convertFromMikrotikProfile(tenantID uuid.UUID, mikrotikProfile *mikrotik.PPPoEProfile) *network.NetworkProfile {
	// Parse rate-limit (format: "download/upload" in bps, e.g., "10M/5M" or "10000000/5000000")
	downloadSpeed := 0
	uploadSpeed := 0

	if mikrotikProfile.RateLimit != "" {
		parts := strings.Split(mikrotikProfile.RateLimit, "/")
		if len(parts) == 2 {
			downloadBps := parseMikrotikRate(parts[0])
			uploadBps := parseMikrotikRate(parts[1])
			// Convert bps to Kbps
			downloadSpeed = downloadBps / 1000
			uploadSpeed = uploadBps / 1000
		}
	}

	// Default values if not parsed
	if downloadSpeed == 0 {
		downloadSpeed = 10000 // 10 Mbps default
	}
	if uploadSpeed == 0 {
		uploadSpeed = 5000 // 5 Mbps default
	}

	profile := &network.NetworkProfile{
		ID:            uuid.New(),
		TenantID:      tenantID,
		Name:          mikrotikProfile.Name,
		DownloadSpeed: downloadSpeed,
		UploadSpeed:   uploadSpeed,
		Priority:      8, // Default
		SharedUsers:   1, // Default
		IsActive:      true,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if mikrotikProfile.LocalAddress != "" {
		profile.LocalAddress = &mikrotikProfile.LocalAddress
	}
	if mikrotikProfile.RemoteAddress != "" {
		profile.RemoteAddress = &mikrotikProfile.RemoteAddress
	}
	if mikrotikProfile.Comment != "" {
		profile.Description = &mikrotikProfile.Comment
	}
	if mikrotikProfile.OnlyOne {
		profile.SharedUsers = 1
	}

	return profile
}

// parseMikrotikRate parses MikroTik rate format (e.g., "10M", "5M", "10000000") to bps
func parseMikrotikRate(rateStr string) int {
	rateStr = strings.TrimSpace(rateStr)
	if rateStr == "" {
		return 0
	}

	// Check if ends with M, K, G
	rateStr = strings.ToUpper(rateStr)
	if strings.HasSuffix(rateStr, "G") {
		val, _ := strconv.Atoi(strings.TrimSuffix(rateStr, "G"))
		return val * 1000000000 // Gbps to bps
	}
	if strings.HasSuffix(rateStr, "M") {
		val, _ := strconv.Atoi(strings.TrimSuffix(rateStr, "M"))
		return val * 1000000 // Mbps to bps
	}
	if strings.HasSuffix(rateStr, "K") {
		val, _ := strconv.Atoi(strings.TrimSuffix(rateStr, "K"))
		return val * 1000 // Kbps to bps
	}

	// Raw bps
	val, _ := strconv.Atoi(rateStr)
	return val
}

// convertToMikrotikProfile converts NetworkProfile to MikroTik PPPoEProfile format
func convertToMikrotikProfile(profile *network.NetworkProfile) mikrotik.PPPoEProfile {
	// Convert Kbps to bps and format as "download/upload" (e.g., "10M/5M" or "10000000/5000000")
	downloadBps := profile.DownloadSpeed * 1000 // Kbps to bps
	uploadBps := profile.UploadSpeed * 1000     // Kbps to bps

	// Format as readable (e.g., "10M/5M") or raw bps if < 1M
	var rateLimit string
	if downloadBps >= 1000000 {
		downloadMbps := downloadBps / 1000000
		uploadMbps := uploadBps / 1000000
		rateLimit = fmt.Sprintf("%dM/%dM", downloadMbps, uploadMbps)
	} else {
		rateLimit = fmt.Sprintf("%d/%d", downloadBps, uploadBps)
	}

	mikrotikProfile := mikrotik.PPPoEProfile{
		Name:         profile.Name,
		RateLimit:    rateLimit,
		OnlyOne:      profile.SharedUsers == 1,
		ChangeTCPMSS: "yes", // Default
		UseUpnp:      "no",  // Default
		Comment:      fmt.Sprintf("RR-NET Profile: %s", profile.Name),
	}

	if profile.LocalAddress != nil {
		mikrotikProfile.LocalAddress = *profile.LocalAddress
	}
	if profile.RemoteAddress != nil {
		mikrotikProfile.RemoteAddress = *profile.RemoteAddress
	}
	if profile.Description != nil {
		mikrotikProfile.Comment = *profile.Description
	}

	return mikrotikProfile
}

func (s *NetworkService) ToggleRemoteAccess(ctx context.Context, id uuid.UUID, enabled bool) (*network.Router, error) {
	router, err := s.routerRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if router.RemoteAccessEnabled == enabled {
		return router, nil
	}

	if enabled {
		// Enable Remote Access
		if router.RemoteAccessPort == 0 {
			routers, err := s.routerRepo.ListByTenant(ctx, router.TenantID)
			if err != nil {
				return nil, err
			}

			usedPorts := make(map[int]bool)
			for _, r := range routers {
				if r.RemoteAccessPort > 0 {
					usedPorts[r.RemoteAccessPort] = true
				}
			}

			startPort := 10500 // Matching mockup
			assignedPort := 0
			for p := startPort; p <= 20000; p++ {
				if !usedPorts[p] {
					assignedPort = p
					break
				}
			}
			if assignedPort == 0 {
				return nil, fmt.Errorf("no available ports for remote access")
			}
			router.RemoteAccessPort = assignedPort
		}

		// Apply IPTables rules if on Linux
		if runtime.GOOS == "linux" {
			// DNAT Rule
			cmd := exec.Command("iptables", "-t", "nat", "-A", "PREROUTING", "-p", "tcp", "--dport", strconv.Itoa(router.RemoteAccessPort), "-j", "DNAT", "--to-destination", router.Host+":8291")
			if out, err := cmd.CombinedOutput(); err != nil {
				return nil, fmt.Errorf("failed to apply PREROUTING rule: %v, output: %s", err, string(out))
			}

			// FORWARD Rule
			cmd = exec.Command("iptables", "-I", "FORWARD", "1", "-p", "tcp", "-d", router.Host, "--dport", "8291", "-j", "ACCEPT")
			if out, err := cmd.CombinedOutput(); err != nil {
				// Cleanup PREROUTING if FORWARD fails
				_ = exec.Command("iptables", "-t", "nat", "-D", "PREROUTING", "-p", "tcp", "--dport", strconv.Itoa(router.RemoteAccessPort), "-j", "DNAT", "--to-destination", router.Host+":8291").Run()
				return nil, fmt.Errorf("failed to apply FORWARD rule: %v, output: %s", err, string(out))
			}
		} else {
			fmt.Printf("[MOCK] Enabling Port Forwarding on non-linux OS: Public Port %d -> %s:8291\n", router.RemoteAccessPort, router.Host)
		}

		router.RemoteAccessEnabled = true
	} else {
		// Disable Remote Access
		if runtime.GOOS == "linux" && router.RemoteAccessPort > 0 {
			// Remove DNAT Rule
			cmd := exec.Command("iptables", "-t", "nat", "-D", "PREROUTING", "-p", "tcp", "--dport", strconv.Itoa(router.RemoteAccessPort), "-j", "DNAT", "--to-destination", router.Host+":8291")
			_ = cmd.Run() // Ignore errors during deletion for robustness

			// Remove FORWARD Rule
			cmd = exec.Command("iptables", "-D", "FORWARD", "-p", "tcp", "-d", router.Host, "--dport", "8291", "-j", "ACCEPT")
			_ = cmd.Run()
		} else {
			fmt.Printf("[MOCK] Disabling Port Forwarding on non-linux OS: Public Port %d\n", router.RemoteAccessPort)
		}

		router.RemoteAccessEnabled = false
	}

	router.UpdatedAt = time.Now()
	if err := s.routerRepo.Update(ctx, router); err != nil {
		return nil, err
	}

	return router, nil
}

func generateRandomString(n int) string {
	b := make([]byte, n/2+1)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)[:n]
}

func (s *NetworkService) generateMikrotikVPNScript(router *network.Router) string {
	publicIP := s.getPublicIP()
	psk := s.getIPsecPSK()

	script := fmt.Sprintf(`## RR-NET SETUP - %s
/interface l2tp-client add add-default-route=no connect-to=%s disabled=no name=l2tp-rrnet password=%s user=%s use-ipsec=yes ipsec-secret=%s
/ip firewall filter add action=accept chain=input comment="Allow ERP Access from VPN" src-address=10.10.10.0/24 dst-port=8728,8291 protocol=tcp place-before=0
/ip service set api disabled=no port=8728
/ip service set api-ssl disabled=yes
/ip service set winbox disabled=no port=8291
/ip service set www disabled=yes
/ip service set ssh port=22
/ip service set telnet disabled=yes
/ip service set ftp disabled=yes
/system identity set name="RR-%s"

## RADIUS & HOTSPOT SETUP
/radius add address=10.10.10.1 secret=dev-radius-rest-secret service=hotspot comment="RR-NET RADIUS"
/ip hotspot profile set [ find default=yes ] use-radius=yes
/ip hotspot user profile set [ find default=yes ] address-pool=none
`, router.Name, publicIP, router.VPNPassword, router.VPNUsername, psk, router.Name)

	return script
}

func (s *NetworkService) getIPsecPSK() string {
	psk := "RRNetSecretPSK" // Default backup
	data, err := os.ReadFile("/etc/ipsec.secrets")
	if err == nil {
		content := string(data)
		parts := strings.Split(content, "PSK")
		if len(parts) > 1 {
			rawPsk := strings.TrimSpace(parts[1])
			psk = strings.Trim(rawPsk, "\"")
		}
	}
	return psk
}

func (s *NetworkService) applyRemoteAccessRules(router *network.Router) error {
	if router.Host == "" || router.RemoteAccessPort <= 0 {
		return nil
	}

	// DNAT Rule for Winbox
	cmd := exec.Command("sudo", "iptables", "-t", "nat", "-A", "PREROUTING", "-p", "tcp", "--dport", strconv.Itoa(router.RemoteAccessPort), "-j", "DNAT", "--to-destination", router.Host+":8291")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to apply PREROUTING rule: %v, output: %s", err, string(out))
	}

	// FORWARD Rule for Winbox
	cmd = exec.Command("sudo", "iptables", "-I", "FORWARD", "1", "-p", "tcp", "-d", router.Host, "--dport", "8291", "-j", "ACCEPT")
	if out, err := cmd.CombinedOutput(); err != nil {
		// Cleanup PREROUTING if FORWARD fails
		_ = exec.Command("sudo", "iptables", "-t", "nat", "-D", "PREROUTING", "-p", "tcp", "--dport", strconv.Itoa(router.RemoteAccessPort), "-j", "DNAT", "--to-destination", router.Host+":8291").Run()
		return fmt.Errorf("failed to apply FORWARD rule: %v, output: %s", err, string(out))
	}

	// Ensure Masquerade for VPN subnet (critical for return path)
	// We use -C to check if rule exists first to avoid duplicates
	checkCmd := exec.Command("sudo", "iptables", "-t", "nat", "-C", "POSTROUTING", "-d", "10.10.10.0/24", "-j", "MASQUERADE")
	if err := checkCmd.Run(); err != nil {
		// Rule does not exist, add it
		if err := exec.Command("sudo", "iptables", "-t", "nat", "-A", "POSTROUTING", "-d", "10.10.10.0/24", "-j", "MASQUERADE").Run(); err != nil {
			fmt.Printf("Warning: failed to add masquerade rule: %v\n", err)
		}
	}

	return nil
}

func (s *NetworkService) removeRemoteAccessRules(router *network.Router) error {
	if router.Host == "" || router.RemoteAccessPort <= 0 {
		return nil
	}

	// Remove DNAT Rule
	cmd := exec.Command("sudo", "iptables", "-t", "nat", "-D", "PREROUTING", "-p", "tcp", "--dport", strconv.Itoa(router.RemoteAccessPort), "-j", "DNAT", "--to-destination", router.Host+":8291")
	_ = cmd.Run()

	// Remove FORWARD Rule
	cmd = exec.Command("sudo", "iptables", "-D", "FORWARD", "-p", "tcp", "-d", router.Host, "--dport", "8291", "-j", "ACCEPT")
	_ = cmd.Run()

	return nil
}

// StartRouterCleanupScheduler starts a ticker to purge old soft-deleted routers
func (s *NetworkService) StartRouterCleanupScheduler(ctx context.Context) {
	ticker := time.NewTicker(24 * time.Hour)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				s.purgeOldRouters(ctx)
			}
		}
	}()
	// Run once on startup
	go s.purgeOldRouters(ctx)
}

func (s *NetworkService) purgeOldRouters(ctx context.Context) {
	retentionDays := 30
	routers, err := s.routerRepo.GetPurgeableRouters(ctx, retentionDays)
	if err != nil {
		log.Error().
			Err(err).
			Msg("RouterCleanup: Error fetching purgeable routers")
		return
	}

	if len(routers) == 0 {
		return
	}

	log.Info().
		Int("router_count", len(routers)).
		Int("retention_days", retentionDays).
		Msg("RouterCleanup: Found routers to purge")

	for _, r := range routers {
		if err := s.routerRepo.HardDelete(ctx, r.ID); err != nil {
			log.Error().
				Str("router_id", r.ID.String()).
				Str("router_name", r.Name).
				Err(err).
				Msg("RouterCleanup: Failed to hard delete router")
		} else {
			log.Info().
				Str("router_id", r.ID.String()).
				Str("router_name", r.Name).
				Msg("RouterCleanup: Purged router")
		}
	}
}

// ========== Isolir Management ==========

// InstallIsolirFirewall installs the firewall rule to block isolated users on a router
func (s *NetworkService) InstallIsolirFirewall(ctx context.Context, routerID uuid.UUID, hotspotIP string) error {
	router, err := s.routerRepo.GetByID(ctx, routerID)
	if err != nil {
		return fmt.Errorf("router not found: %w", err)
	}

	if router.Type != network.RouterTypeMikroTik {
		return fmt.Errorf("only MikroTik routers are supported")
	}

	// Build MikroTik API address
	addr := fmt.Sprintf("%s:%d", router.Host, router.APIPort)

	// Install firewall rules (NAT redirect + Filter blocks)
	err = mikrotik.InstallIsolirFirewall(ctx, addr, router.APIUseTLS, router.Username, router.Password, hotspotIP)
	if err != nil {
		log.Error().
			Err(err).
			Str("router_id", routerID.String()).
			Str("router_name", router.Name).
			Str("hotspot_ip", hotspotIP).
			Msg("Failed to install isolir firewall")
		return fmt.Errorf("failed to install isolir firewall: %w", err)
	}

	log.Info().
		Str("router_id", routerID.String()).
		Str("router_name", router.Name).
		Str("hotspot_ip", hotspotIP).
		Msg("Isolir firewall installed successfully")

	return nil
}

// UninstallIsolirFirewall removes all isolir firewall rules from a router
func (s *NetworkService) UninstallIsolirFirewall(ctx context.Context, routerID uuid.UUID) error {
	router, err := s.routerRepo.GetByID(ctx, routerID)
	if err != nil {
		return fmt.Errorf("router not found: %w", err)
	}

	if router.Type != network.RouterTypeMikroTik {
		return fmt.Errorf("only MikroTik routers are supported")
	}

	// Build MikroTik API address
	addr := fmt.Sprintf("%s:%d", router.Host, router.APIPort)

	// Uninstall firewall rules
	err = mikrotik.UninstallIsolirFirewall(ctx, addr, router.APIUseTLS, router.Username, router.Password)
	if err != nil {
		log.Error().
			Err(err).
			Str("router_id", routerID.String()).
			Str("router_name", router.Name).
			Msg("Failed to uninstall isolir firewall")
		return fmt.Errorf("failed to uninstall isolir firewall: %w", err)
	}

	log.Info().
		Str("router_id", routerID.String()).
		Str("router_name", router.Name).
		Msg("Isolir firewall uninstalled successfully")

	return nil
}

// IsolirStatus represents the status of isolir firewall on a router
type IsolirStatus struct {
	FirewallInstalled bool   `json:"firewall_installed"`
	RouterID          string `json:"router_id"`
	RouterName        string `json:"router_name"`
	RuleCount         int    `json:"rule_count"`
	HotspotIP         string `json:"hotspot_ip,omitempty"`
	HasNAT            bool   `json:"has_nat"`
	HasFilter         bool   `json:"has_filter"`
}

// GetIsolirStatus checks if isolir firewall is installed on a router
func (s *NetworkService) GetIsolirStatus(ctx context.Context, routerID uuid.UUID) (*IsolirStatus, error) {
	router, err := s.routerRepo.GetByID(ctx, routerID)
	if err != nil {
		return nil, fmt.Errorf("router not found: %w", err)
	}

	if router.Type != network.RouterTypeMikroTik {
		return nil, fmt.Errorf("only MikroTik routers are supported")
	}

	// Build MikroTik API address
	addr := fmt.Sprintf("%s:%d", router.Host, router.APIPort)

	// Check firewall status
	status, err := mikrotik.CheckIsolirFirewall(ctx, addr, router.APIUseTLS, router.Username, router.Password)
	if err != nil {
		log.Error().
			Err(err).
			Str("router_id", routerID.String()).
			Str("router_name", router.Name).
			Msg("Failed to check isolir firewall status")
		return nil, fmt.Errorf("failed to check isolir firewall status: %w", err)
	}

	return &IsolirStatus{
		FirewallInstalled: status.Installed,
		RouterID:          router.ID.String(),
		RouterName:        router.Name,
		RuleCount:         status.RuleCount,
		HotspotIP:         status.HotspotIP,
		HasNAT:            status.HasNAT,
		HasFilter:         status.HasFilter,
	}, nil
}
