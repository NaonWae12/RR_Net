package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

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

// ========== Router Operations ==========

type CreateRouterRequest struct {
	Name               string                         `json:"name"`
	Description        string                         `json:"description,omitempty"`
	Type               network.RouterType             `json:"type"`
	Host               string                         `json:"host"`
	NASIP              string                         `json:"nas_ip,omitempty"`
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
	EnableRemoteAccess bool                           `json:"enable_remote_access"`
}

func (s *NetworkService) CreateRouter(ctx context.Context, tenantID uuid.UUID, req CreateRouterRequest) (*network.Router, error) {
	now := time.Now()
	router := &network.Router{
		ID:               uuid.New(),
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
		// Generate VPN credentials
		router.VPNUsername = "vpn-" + router.Name + "-" + generateRandomString(4)
		router.VPNPassword = generateRandomString(12)

		// Execute script to add VPN user and get IP
		cmd := exec.Command("sudo", "/opt/rrnet/scripts/vpn_add_user_auto.sh", router.VPNUsername, router.VPNPassword)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return nil, fmt.Errorf("failed to create VPN account: %v, output: %s", err, string(out))
		}
		router.Host = string(net.ParseIP(strings.TrimSpace(string(out)))) // Clean output
		vpnIP := strings.TrimSpace(string(out))
		if net.ParseIP(vpnIP) == nil {
			return nil, fmt.Errorf("invalid IP returned from vpn script: %s", vpnIP)
		}
		router.Host = vpnIP
		router.VPNUsername = router.VPNUsername // Already set
		router.VPNPassword = router.VPNPassword // Already set
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
			// DNAT Rule
			cmd := exec.Command("sudo", "iptables", "-t", "nat", "-A", "PREROUTING", "-p", "tcp", "--dport", strconv.Itoa(router.RemoteAccessPort), "-j", "DNAT", "--to-destination", router.Host+":8291")
			if out, err := cmd.CombinedOutput(); err != nil {
				return nil, fmt.Errorf("failed to apply PREROUTING rule: %v, output: %s", err, string(out))
			}

			// FORWARD Rule
			cmd = exec.Command("sudo", "iptables", "-A", "FORWARD", "-p", "tcp", "-d", router.Host, "--dport", "8291", "-j", "ACCEPT")
			if out, err := cmd.CombinedOutput(); err != nil {
				_ = exec.Command("sudo", "iptables", "-t", "nat", "-D", "PREROUTING", "-p", "tcp", "--dport", strconv.Itoa(router.RemoteAccessPort), "-j", "DNAT", "--to-destination", router.Host+":8291").Run()
				return nil, fmt.Errorf("failed to apply FORWARD rule: %v, output: %s", err, string(out))
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
	Name             string                         `json:"name,omitempty"`
	Description      string                         `json:"description,omitempty"`
	Type             network.RouterType             `json:"type,omitempty"`
	Host             string                         `json:"host,omitempty"`
	NASIP            string                         `json:"nas_ip,omitempty"`
	Port             int                            `json:"port,omitempty"`
	Username         string                         `json:"username,omitempty"`
	Password         string                         `json:"password,omitempty"`
	APIPort          int                            `json:"api_port,omitempty"`
	APIUseTLS        *bool                          `json:"api_use_tls,omitempty"`
	ConnectivityMode network.RouterConnectivityMode `json:"connectivity_mode,omitempty"`
	IsDefault        bool                           `json:"is_default"`
	RadiusEnabled    *bool                          `json:"radius_enabled,omitempty"`
	RadiusSecret     string                         `json:"radius_secret,omitempty"`
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
	router.IsDefault = req.IsDefault
	router.UpdatedAt = time.Now()

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
	LocalAddress  string `json:"local_address,omitempty"`
	RemoteAddress string `json:"remote_address,omitempty"`
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
	if req.LocalAddress != "" {
		profile.LocalAddress = &req.LocalAddress
	}
	if req.RemoteAddress != "" {
		profile.RemoteAddress = &req.RemoteAddress
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
	LocalAddress  string `json:"local_address,omitempty"`
	RemoteAddress string `json:"remote_address,omitempty"`
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
	if req.LocalAddress != "" {
		profile.LocalAddress = &req.LocalAddress
	}
	if req.RemoteAddress != "" {
		profile.RemoteAddress = &req.RemoteAddress
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
			cmd = exec.Command("iptables", "-A", "FORWARD", "-p", "tcp", "-d", router.Host, "--dport", "8291", "-j", "ACCEPT")
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
	// Try to get PSK from /etc/ipsec.secrets
	psk := "RRNetSecretPSK"    // Default backup
	publicIP := "72.60.74.209" // Default/Current VPS IP

	data, err := os.ReadFile("/etc/ipsec.secrets")
	if err == nil {
		content := string(data)
		// Usually: IP : PSK "secret"
		parts := strings.Split(content, "PSK")
		if len(parts) > 1 {
			psk = strings.TrimSpace(parts[1])
			psk = strings.Trim(psk, "\"")
		}
	}

	script := fmt.Sprintf(`/interface l2tp-client
add connect-to=%s disabled=no name=l2tp-erp password=%s user=%s use-ipsec=yes ipsec-secret=%s
/ip service
set api disabled=no port=8728
set winbox disabled=no port=8291
/ip firewall filter
add chain=input action=accept protocol=tcp dst-port=8728,8291 src-address=10.10.10.1 comment="Allow ERP Access from VPN"
`, publicIP, router.VPNPassword, router.VPNUsername, psk)

	if router.RemoteAccessEnabled && router.RemoteAccessPort > 0 {
		script += fmt.Sprintf("## Remote Access enabled on port: %d\n", router.RemoteAccessPort)
	}

	return script
}
