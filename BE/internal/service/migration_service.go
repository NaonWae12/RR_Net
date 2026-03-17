package service

import (
	"context"
	"fmt"
	"strings"

	"rrnet/internal/domain/ai"
	"rrnet/internal/domain/client"
	"rrnet/internal/repository"

	"github.com/google/uuid"
	"golang.org/x/sync/errgroup"
)

type MigrationService struct {
	aiService  *AIService
	clientRepo *repository.ClientRepository
	pppoeRepo  *repository.PPPoERepository
	pkgRepo    *repository.ServicePackageRepository
	voucherRepo *repository.VoucherRepository
	clientService *ClientService
}

func NewMigrationService(aiService *AIService, clientRepo *repository.ClientRepository, pppoeRepo *repository.PPPoERepository, pkgRepo *repository.ServicePackageRepository, voucherRepo *repository.VoucherRepository, clientService *ClientService) *MigrationService {
	return &MigrationService{
		aiService:  aiService,
		clientRepo: clientRepo,
		pppoeRepo:  pppoeRepo,
		pkgRepo:    pkgRepo,
		voucherRepo: voucherRepo,
		clientService: clientService,
	}
}

// Dummy comment to trigger re-index

// ExtractClientDataFromImage uses AI to extract client information from a photo/document or pre-extracted text
func (s *MigrationService) ExtractClientDataFromImage(ctx context.Context, tenantID uuid.UUID, base64Image string, promptOverride string) (*ai.ExtractionResult, error) {
	basePrompt := `
Extract client registration data.
The input may be an image OR a pipe-separated (" | ") text table.
For each row, extract the client details.

The output MUST be a JSON object with the following structure:
{
	"data": [
		{
			"name": "Full name of the client",
			"email": "Official email address",
			"address": "PHYSICAL ADDRESS (If row doesn't have an address, use the document TITLE/HEADER as address. E.g. if 'Cibuaya' is the title, use it for all rows.)",
			"phone": "whatsapp/cellphone number",
			"nik": "National ID number (NIK)",
			"package": "Internet package/speed/service plan (Look for prices like Rp100.000)",
			"username": "Service account username (e.g. PPPoE user)",
			"password": "Service account password",
			"local_address": "Networking: Local IP address (OPTIONAL)",
			"remote_address": "Networking: Remote/Static IP address (OPTIONAL)"
		}
	],
	"confidence": 0.95,
	"highlights": ["any ambiguous fields"]
}
If multiple clients are found, extract all of them.
- ADDRESS EXTRACTION: Be flexible. If an address is mentioned at the TOP of the page or as a title, apply it to all clients in that table.
- Look for common Indonesian patterns like "Jl.", "RT", "RW", "No.", "Gg.", "Dusun", "Desa", etc. but DON'T be too strict.
- Do NOT confuse residential 'address' with 'local_address' (IP address).
- Always include "name" and "package".
`

	finalPrompt := basePrompt
	if promptOverride != "" {
		finalPrompt = "Source Data:\n" + promptOverride + "\n\nTask:\n" + basePrompt
	}

	var imgPtr *string
	if base64Image != "" {
		imgPtr = &base64Image
	}

	return s.aiService.Extract(ctx, tenantID, finalPrompt, imgPtr, nil)
}

func (s *MigrationService) ExtractClientDataFromExcel(ctx context.Context, tenantID uuid.UUID, fileData []byte) (*ai.ExtractionResult, error) {
	// For Excel, we might want to convert it to CSV/Text first or just let AI read the raw text if possible.
	// For now, simpler prompt for raw text extraction.
	prompt := `Extract client details from this Excel data... (similar JSON structure)`
	return s.aiService.Extract(ctx, tenantID, prompt, nil, fileData)
}

// ProcessBulkImport takes the extracted data and creates clients in the database
func (s *MigrationService) ProcessBulkImport(ctx context.Context, tenantID uuid.UUID, clients []map[string]interface{}) error {
	// 0. Fetch packages for mapping
	packages, err := s.pkgRepo.ListByTenant(ctx, tenantID, true, nil)
	if err != nil {
		return err
	}
	pkgMap := make(map[string]uuid.UUID)
	for _, p := range packages {
		pkgMap[strings.ToLower(p.Name)] = p.ID
	}

	// Fetch Hotspot packages
	vPackages, _ := s.voucherRepo.ListPackagesByTenant(ctx, tenantID, true)
	vPkgMap := make(map[string]uuid.UUID)
	for _, vp := range vPackages {
		vPkgMap[strings.ToLower(vp.Name)] = vp.ID
	}

	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(5) // Limit concurrency to avoid overwhelming router/DB

	for _, clientData := range clients {
		cData := clientData // Capture for goroutine
		name, _ := cData["name"].(string)
		if name == "" {
			continue // Skip invalid rows
		}

		g.Go(func() error {
			// Prepare CreateClientRequest
			req := &CreateClientRequest{
				Name:           name,
				Category:       client.Category(s.getString(cData, "category", "regular")),
				ConnectionType: client.ConnectionType(s.getString(cData, "connection_type", "pppoe")),
			}

			// Map string fields
			if email, ok := cData["email"].(string); ok && email != "" {
				req.Email = &email
			}
			if phone, ok := cData["phone"].(string); ok && phone != "" {
				req.Phone = &phone
			}
			if address, ok := cData["address"].(string); ok && address != "" {
				req.Address = &address
			}
			if uname, ok := cData["pppoe_username"].(string); ok && uname != "" {
				req.PPPoEUsername = &uname
			}
			if pass, ok := cData["pppoe_password"].(string); ok && pass != "" {
				req.PPPoEPassword = &pass
			}
			if localIP, ok := cData["pppoe_local_address"].(string); ok && localIP != "" {
				req.PPPoELocalAddress = &localIP
			}
			if remoteIP, ok := cData["pppoe_remote_address"].(string); ok && remoteIP != "" {
				req.PPPoERemoteAddress = &remoteIP
			}

			// Handle Package Mapping
			pkgName, _ := cData["package"].(string)
			if pkgName != "" {
				if req.ConnectionType == client.ConnectionTypeHotspot {
					// Map to VoucherPackage for Hotspot
					if id, err := uuid.Parse(pkgName); err == nil {
						req.VoucherPackageID = &id
					} else if id, ok := vPkgMap[strings.ToLower(pkgName)]; ok {
						req.VoucherPackageID = &id
					}
				} else {
					// Map to ServicePackage for others (PPPoE, etc)
					if id, err := uuid.Parse(pkgName); err == nil {
						req.ServicePackageID = &id
					} else if id, ok := pkgMap[strings.ToLower(pkgName)]; ok {
						req.ServicePackageID = &id
					}
				}
			}

			// Handle Vouchers for Hotspot (explicitly provided)
			if vpkgIDStr, ok := cData["voucher_package_id"].(string); ok && vpkgIDStr != "" {
				if id, err := uuid.Parse(vpkgIDStr); err == nil {
					req.VoucherPackageID = &id
				}
			}

			// Router
			if routerIDStr, ok := cData["router_id"].(string); ok && routerIDStr != "" {
				if id, err := uuid.Parse(routerIDStr); err == nil {
					req.RouterID = &id
				}
			}

			// Group
			if groupIDStr, ok := cData["group_id"].(string); ok && groupIDStr != "" {
				if id, err := uuid.Parse(groupIDStr); err == nil {
					req.GroupID = &id
				}
			}

			// Payment Due
			if dueDay, ok := cData["payment_due_day"].(float64); ok {
				dayInt := int(dueDay)
				req.PaymentDueDay = &dayInt
			}

			// Device Count (primarily for Hotspot/Lite)
			if deviceCount, ok := cData["device_count"].(float64); ok {
				dcInt := int(deviceCount)
				req.DeviceCount = &dcInt
			}

			// Use ClientService to create (handles User creation, MikroTik sync, etc.)
			_, err := s.clientService.Create(ctx, tenantID, req)
			if err != nil {
				return fmt.Errorf("failed to create client %s: %w", name, err)
			}
			return nil
		})
	}

	return g.Wait()
}

func (s *MigrationService) getString(m map[string]interface{}, key string, def string) string {
	if val, ok := m[key].(string); ok && val != "" {
		return val
	}
	return def
}
