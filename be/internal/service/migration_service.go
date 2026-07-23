package service

import (
	"context"
	"fmt"
	"strconv"
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
	// Fetch available packages to help AI map package names accurately
	packages, _ := s.pkgRepo.ListByTenant(ctx, tenantID, true, nil)
	vPackages, _ := s.voucherRepo.ListPackagesByTenant(ctx, tenantID, true)
	
	var systemPkgNames []string
	for _, p := range packages {
		systemPkgNames = append(systemPkgNames, p.Name)
	}
	var hotspotPkgNames []string
	for _, vp := range vPackages {
		hotspotPkgNames = append(hotspotPkgNames, vp.Name)
	}

	pkgContext := ""
	if len(systemPkgNames) > 0 || len(hotspotPkgNames) > 0 {
		pkgContext = fmt.Sprintf("\nAVAILABLE SYSTEM SERVICE PACKAGES: %v\nAVAILABLE HOTSPOT PACKAGES: %v\nIMPORTANT: If the package/price/speed in the document matches or closely resembles one of the AVAILABLE packages above, output the EXACT package name from the list above for the 'package' field!\n", systemPkgNames, hotspotPkgNames)
	}

	basePrompt := fmt.Sprintf(`
Extract client registration data from document/image/text.
The input may be a photo of an Excel/Word document, table, registration form, or handwritten list.
For EACH row or client entry, extract the client details into a JSON object.
%s
OUTPUT JSON STRUCTURE:
{
	"data": [
		{
			"name": "Client full name (MANDATORY)",
			"email": "Client email if present",
			"address": "Physical residential address if present",
			"phone": "Phone/WhatsApp/cellphone number if present",
			"nik": "National ID / NIK if present",
			"package": "Package name, speed, service plan, OR nominal price (e.g. Rp100.000, 90.000, 100k) if present",
			"username": "PPPoE or Hotspot login username if present",
			"password": "PPPoE or Hotspot login password if present",
			"local_address": "Local IP if present",
			"remote_address": "Remote/Static IP if present"
		}
	],
	"confidence": 0.95,
	"highlights": []
}

RULES FOR EXTRACTION:
1. MANDATORY REQUIREMENT: 'name' is the ONLY mandatory field. Extract EVERY single client row in the document, even if a row ONLY contains a name or name + price/nominal!
2. DO NOT SKIP ANY ROW: If a row has a name (e.g. "Santi", "Ariyah", "Asep", "Bi Hamimah", "Herli"), it MUST be extracted.
3. CRITICAL - OMIT EMPTY FIELDS: Do NOT output keys with empty string values (""). If a field (email, phone, address, package, password, etc.) is missing, OMIT the key entirely! (e.g. output {"name": "Santi", "package": "Rp100.000"})
4. PACKAGE / PRICE COLUMN: If a column contains prices like "Rp100.000", "Rp90.000", "Rp50.000", "Rp 135.000", "100k", etc., extract this value into the 'package' field!
5. PHONE / HP EXTRACTION: Look for columns with numbers starting with 08..., +62..., or headers like HP, WA, Telp, Mobile, Contact, No HP. Extract them into the 'phone' field.
6. ADDRESS TITLE: If an overall address or location title is at the top of the table (e.g. "Dusun Cibuaya"), use it for 'address' if individual rows don't have addresses.
`, pkgContext)

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
	prompt := `Extract client details from this Excel data... (similar JSON structure)`
	return s.aiService.Extract(ctx, tenantID, prompt, nil, fileData)
}

// parsePrice extracts numeric price from string like "Rp100.000", "90k", "50.000"
func parsePrice(s string) float64 {
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, "rp", "")
	s = strings.ReplaceAll(s, "k", "000")
	var cleaned strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			cleaned.WriteRune(r)
		}
	}
	if cleaned.Len() == 0 {
		return 0
	}
	val, _ := strconv.ParseFloat(cleaned.String(), 64)
	return val
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
			} else if uname, ok := cData["username"].(string); ok && uname != "" {
				req.PPPoEUsername = &uname
			}
			if pass, ok := cData["pppoe_password"].(string); ok && pass != "" {
				req.PPPoEPassword = &pass
			} else if pass, ok := cData["password"].(string); ok && pass != "" {
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
				pkgNameLower := strings.ToLower(strings.TrimSpace(pkgName))
				if req.ConnectionType == client.ConnectionTypeHotspot {
					// Map to VoucherPackage for Hotspot
					if id, err := uuid.Parse(pkgName); err == nil {
						req.VoucherPackageID = &id
					} else if id, ok := vPkgMap[pkgNameLower]; ok {
						req.VoucherPackageID = &id
					} else {
						// Price fallback matching
						targetPrice := parsePrice(pkgNameLower)
						if targetPrice > 0 {
							for _, vp := range vPackages {
								if vp.Price == targetPrice {
									id := vp.ID
									req.VoucherPackageID = &id
									break
								}
							}
						}
					}
				} else {
					// Map to ServicePackage for others (PPPoE, etc)
					if id, err := uuid.Parse(pkgName); err == nil {
						req.ServicePackageID = &id
					} else if id, ok := pkgMap[pkgNameLower]; ok {
						req.ServicePackageID = &id
					} else {
						// Price fallback matching
						targetPrice := parsePrice(pkgNameLower)
						if targetPrice > 0 {
							for _, p := range packages {
								if p.PriceMonthly == targetPrice || p.PricePerDevice == targetPrice {
									id := p.ID
									req.ServicePackageID = &id
									break
								}
							}
						}
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
