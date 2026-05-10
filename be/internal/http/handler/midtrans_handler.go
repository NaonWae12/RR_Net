package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"rrnet/internal/service"
	"github.com/rs/zerolog/log"
)


type MidtransHandler struct {
	midtransService        *service.MidtransService
	platformBillingService *service.PlatformBillingService
	siteSettingService     service.SiteSettingService
	portalService          *service.PortalService
	resellerService        *service.ResellerService
	tenantService          *service.TenantService
}

func NewMidtransHandlerV2(
	midtransService *service.MidtransService,
	platformBillingService *service.PlatformBillingService,
	siteSettingService service.SiteSettingService,
	portalService *service.PortalService,
	resellerService *service.ResellerService,
	tenantService *service.TenantService,
) *MidtransHandler {
	return &MidtransHandler{
		midtransService:        midtransService,
		platformBillingService: platformBillingService,
		siteSettingService:     siteSettingService,
		portalService:          portalService,
		resellerService:        resellerService,
		tenantService:          tenantService,
	}
}

// HandlePlatformWebhook handles notifications from Midtrans platform account
func (h *MidtransHandler) HandlePlatformWebhook(w http.ResponseWriter, r *http.Request) {
	var notification map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&notification); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	orderID, _ := notification["order_id"].(string)
	statusCode, _ := notification["status_code"].(string)
	grossAmount, _ := notification["gross_amount"].(string)
	signatureKey, _ := notification["signature_key"].(string)

	log.Info().Str("order_id", orderID).Str("status", statusCode).Msg("Received Midtrans Platform Webhook")

	// 1. Get platform server key to verify signature
	config, err := h.siteSettingService.GetMidtransConfig(r.Context())
	if err != nil || !config.Enabled {
		log.Error().Err(err).Msg("Failed to get platform Midtrans config for webhook verification")
		http.Error(w, "Config not found", http.StatusInternalServerError)
		return
	}

	// 2. Verify Signature
	if !h.midtransService.VerifyNotification(orderID, statusCode, grossAmount, signatureKey, config.ServerKey) {
		log.Warn().Str("order_id", orderID).Msg("Invalid Midtrans signature")
		http.Error(w, "Invalid signature", http.StatusForbidden)
		return
	}

	// 3. Process status
	transactionStatus, _ := notification["transaction_status"].(string)
	if transactionStatus == "capture" || transactionStatus == "settlement" {
		// Payment successful!
		var amount int64
		if amt, ok := notification["gross_amount"].(string); ok {
			// Midtrans gross_amount is sometimes a float string "10000.00"
			var f float64
			fmt.Sscanf(amt, "%f", &f)
			amount = int64(f)
		}

		if err := h.platformBillingService.HandleMidtransPayment(r.Context(), orderID, amount); err != nil {
			log.Error().Err(err).Str("order_id", orderID).Msg("Failed to process Midtrans payment success")
			http.Error(w, "Processing failed", http.StatusInternalServerError)
			return
		}
		log.Info().Str("order_id", orderID).Msg("Platform payment confirmed and fulfilled via Midtrans")
	}

	w.WriteHeader(http.StatusOK)
}

// HandleTenantWebhook handles notifications from Tenant's Midtrans account
func (h *MidtransHandler) HandleTenantWebhook(w http.ResponseWriter, r *http.Request) {
	var notification map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&notification); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	orderID, _ := notification["order_id"].(string)
	statusCode, _ := notification["status_code"].(string)
	grossAmount, _ := notification["gross_amount"].(string)
	signatureKey, _ := notification["signature_key"].(string)

	log.Info().Str("order_id", orderID).Str("status", statusCode).Msg("Received Midtrans Tenant Webhook")

	// 1. Determine tenant and type (Portal or Reseller) from OrderID
	// OrderID formats: PT_[invoiceID]_[timestamp] or RS_[purchaseID]_[timestamp]
	parts := strings.Split(orderID, "_")
	if len(parts) < 2 {
		log.Warn().Str("order_id", orderID).Msg("Invalid order ID format in tenant webhook")
		http.Error(w, "Invalid order id", http.StatusBadRequest)
		return
	}

	prefix := parts[0]
	idStr := parts[1]
	id, err := uuid.Parse(idStr)
	if err != nil {
		log.Warn().Str("order_id", orderID).Msg("Failed to parse UUID from order ID")
		http.Error(w, "Invalid ID in order id", http.StatusBadRequest)
		return
	}

	var tenantID uuid.UUID
	switch prefix {
	case "PT":
		// Lookup portal invoice to find tenant
		inv, err := h.portalService.GetInvoiceByIDRaw(r.Context(), id)
		if err != nil {
			log.Error().Err(err).Str("invoice_id", idStr).Msg("Portal invoice not found for webhook")
			http.Error(w, "Invoice not found", http.StatusNotFound)
			return
		}
		tenantID = inv.TenantID
	case "RS":
		// Lookup reseller purchase to find tenant
		p, err := h.resellerService.GetPurchaseByIDRaw(r.Context(), id)
		if err != nil {
			log.Error().Err(err).Str("purchase_id", idStr).Msg("Reseller purchase not found for webhook")
			http.Error(w, "Purchase not found", http.StatusNotFound)
			return
		}
		tenantID = p.TenantID
	default:
		log.Warn().Str("order_id", orderID).Msg("Unknown order ID prefix in tenant webhook")
		http.Error(w, "Unknown order prefix", http.StatusBadRequest)
		return
	}

	// 2. Get tenant's Midtrans config to verify signature
	config, err := h.tenantService.GetMidtransConfig(r.Context(), tenantID)
	if err != nil || !config.Enabled {
		log.Error().Err(err).Str("tenant_id", tenantID.String()).Msg("Failed to get tenant Midtrans config for webhook")
		http.Error(w, "Config not found", http.StatusInternalServerError)
		return
	}

	// 3. Verify Signature
	if !h.midtransService.VerifyNotification(orderID, statusCode, grossAmount, signatureKey, config.ServerKey) {
		log.Warn().Str("order_id", orderID).Msg("Invalid Midtrans signature for tenant webhook")
		http.Error(w, "Invalid signature", http.StatusForbidden)
		return
	}

	// 4. Process status
	transactionStatus, _ := notification["transaction_status"].(string)
	if transactionStatus == "capture" || transactionStatus == "settlement" {
		var amount int64
		if amt, ok := notification["gross_amount"].(string); ok {
			var f float64
			fmt.Sscanf(amt, "%f", &f)
			amount = int64(f)
		}

		switch prefix {
		case "PT":
			if err := h.portalService.HandleMidtransPayment(r.Context(), tenantID, orderID, amount); err != nil {
				log.Error().Err(err).Str("order_id", orderID).Msg("Failed to process portal Midtrans payment")
				http.Error(w, "Processing failed", http.StatusInternalServerError)
				return
			}
		case "RS":
			if err := h.resellerService.HandleMidtransPayment(r.Context(), tenantID, orderID, amount); err != nil {
				log.Error().Err(err).Str("order_id", orderID).Msg("Failed to process reseller Midtrans payment")
				http.Error(w, "Processing failed", http.StatusInternalServerError)
				return
			}
		}
		log.Info().Str("order_id", orderID).Msg("Tenant payment confirmed and fulfilled via Midtrans")
	}

	w.WriteHeader(http.StatusOK)
}
