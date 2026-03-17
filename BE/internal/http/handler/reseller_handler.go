package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/auth"
	"rrnet/internal/domain/reseller"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

// ResellerHandler handles reseller-related HTTP requests
type ResellerHandler struct {
	svc *service.ResellerService
}

// NewResellerHandler creates a new reseller handler
func NewResellerHandler(svc *service.ResellerService) *ResellerHandler {
	return &ResellerHandler{svc: svc}
}

// ========== Reseller Management ==========

type UpgradeClientRequest struct {
	ClientID string  `json:"client_id"`
	Notes    *string `json:"notes,omitempty"`
}

func (h *ResellerHandler) UpgradeClient(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var req UpgradeClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	clientID, err := uuid.Parse(req.ClientID)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid client_id")
		return
	}

	res, err := h.svc.UpgradeClientToReseller(r.Context(), tenantID, clientID, req.Notes)
	if err != nil {
		if err == service.ErrResellerAlreadyExists {
			sendError(w, http.StatusConflict, "Client is already a reseller")
			return
		}
		log.Error().Err(err).Msg("Failed to upgrade client to reseller")
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, map[string]interface{}{
		"data": res,
	})
}

func (h *ResellerHandler) RegisterReseller(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	log.Info().Str("tenant_id", tenantID.String()).Str("user_id", userID.String()).Msg("[RESELLER_REGISTER] Looking up client for user")

	// Resolve ClientID from UserID
	client, err := h.svc.GetClientByUserID(r.Context(), tenantID, userID)
	if err != nil {
		if err == repository.ErrClientNotFound {
			log.Warn().Str("tenant_id", tenantID.String()).Str("user_id", userID.String()).Msg("[RESELLER_REGISTER] User is not linked to any client profile")
			sendError(w, http.StatusForbidden, "User is not linked to any client profile")
			return
		}
		log.Error().Err(err).Str("tenant_id", tenantID.String()).Str("user_id", userID.String()).Msg("[RESELLER_REGISTER] Failed to resolve client from user")
		sendError(w, http.StatusInternalServerError, "Failed to resolve client")
		return
	}

	log.Info().Str("tenant_id", tenantID.String()).Str("user_id", userID.String()).Str("client_id", client.ID.String()).Str("client_name", client.Name).Msg("[RESELLER_REGISTER] Client found, proceeding with registration")

	res, err := h.svc.RegisterClientAsReseller(r.Context(), tenantID, client.ID)
	if err != nil {
		if err == service.ErrResellerAlreadyExists {
			sendError(w, http.StatusConflict, "Client is already a reseller or has pending request")
			return
		}
		log.Error().Err(err).Msg("Failed to register reseller")
		sendError(w, http.StatusInternalServerError, "Failed to register reseller")
		return
	}

	sendJSON(w, http.StatusCreated, map[string]interface{}{
		"data": res,
	})
}

func (h *ResellerHandler) GetMyResellerStatus(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	log.Info().Str("tenant_id", tenantID.String()).Str("user_id", userID.String()).Msg("[RESELLER_STATUS] Looking up client for user")

	// Resolve ClientID from UserID
	client, err := h.svc.GetClientByUserID(r.Context(), tenantID, userID)
	if err != nil {
		// If user handles portal but has no client profile, they basically have no reseller status
		log.Info().Str("tenant_id", tenantID.String()).Str("user_id", userID.String()).Msg("[RESELLER_STATUS] User has no client profile, returning null")
		sendJSON(w, http.StatusOK, map[string]interface{}{"data": nil})
		return
	}

	log.Info().Str("tenant_id", tenantID.String()).Str("user_id", userID.String()).Str("client_id", client.ID.String()).Msg("[RESELLER_STATUS] Client found, checking reseller status")

	res, err := h.svc.GetResellerByClientID(r.Context(), tenantID, client.ID)
	if err != nil {
		// If not found, return null data indicating not registered
		sendJSON(w, http.StatusOK, map[string]interface{}{"data": nil})
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data": res,
	})
}

func (h *ResellerHandler) GetMyPrices(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Resolve ClientID from UserID
	client, err := h.svc.GetClientByUserID(r.Context(), tenantID, userID)
	if err != nil {
		sendJSON(w, http.StatusOK, map[string]interface{}{"data": []string{}})
		return
	}

	// Get Reseller
	res, err := h.svc.GetResellerByClientID(r.Context(), tenantID, client.ID)
	if err != nil {
		sendJSON(w, http.StatusOK, map[string]interface{}{"data": []string{}})
		return
	}

	prices, err := h.svc.GetResellerPrices(r.Context(), tenantID, res.ID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get reseller prices")
		sendError(w, http.StatusInternalServerError, "Failed to get prices")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data": prices,
	})
}

func (h *ResellerHandler) ProcessMyPurchase(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Resolve ClientID from UserID
	client, err := h.svc.GetClientByUserID(r.Context(), tenantID, userID)
	if err != nil {
		sendError(w, http.StatusForbidden, "User profile not found")
		return
	}

	// Get Reseller
	res, err := h.svc.GetResellerByClientID(r.Context(), tenantID, client.ID)
	if err != nil {
		sendError(w, http.StatusForbidden, "Only active resellers can purchase vouchers")
		return
	}

	if res.Status != reseller.StatusActive {
		sendError(w, http.StatusForbidden, "Reseller account is not active")
		return
	}

	var req ProcessPurchaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	packageID, err := uuid.Parse(req.VoucherPackageID)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid voucher_package_id")
		return
	}

	if req.Quantity < 1 {
		sendError(w, http.StatusBadRequest, "Quantity must be at least 1")
		return
	}

	// Use the router associated with the client account
	routerID := client.RouterID
	if routerID == nil {
		sendError(w, http.StatusForbidden, "Your account does not have a router assigned. Please contact administrator.")
		return
	}

	purchase, err := h.svc.ProcessPurchase(r.Context(), tenantID, res.ID, packageID, routerID, req.Quantity, req.PaymentMethod, req.PromoCode)
	if err != nil {
		log.Error().Err(err).Msg("Portal purchase failed")
		if errors.Is(err, service.ErrInsufficientBalance) {
			sendError(w, http.StatusBadRequest, "Saldo tidak mencukupi untuk melakukan pembelian ini")
			return
		}
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, map[string]interface{}{
		"data": purchase,
	})
}

func (h *ResellerHandler) ListResellers(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var filter reseller.ResellerListFilter
	if status := r.URL.Query().Get("status"); status != "" {
		s := reseller.Status(status)
		filter.Status = &s
	}
	filter.Search = r.URL.Query().Get("search")

	if page := r.URL.Query().Get("page"); page != "" {
		if p, err := strconv.Atoi(page); err == nil {
			filter.Page = p
		}
	}

	if pageSize := r.URL.Query().Get("page_size"); pageSize != "" {
		if ps, err := strconv.Atoi(pageSize); err == nil {
			filter.PageSize = ps
		}
	}

	resellers, total, err := h.svc.ListResellers(r.Context(), tenantID, filter)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list resellers")
		sendError(w, http.StatusInternalServerError, "Failed to list resellers")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data":  resellers,
		"total": total,
		"page":  filter.Page,
	})
}

func (h *ResellerHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	resellerID, err := uuid.Parse(getPathParam(r, "reseller_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid reseller_id")
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	status := reseller.Status(req.Status)
	if status != reseller.StatusActive && status != reseller.StatusSuspended && status != reseller.StatusRejected && status != reseller.StatusPending {
		sendError(w, http.StatusBadRequest, "Invalid status")
		return
	}

	if err := h.svc.UpdateResellerStatus(r.Context(), tenantID, resellerID, status); err != nil {
		if err == service.ErrResellerNotFound {
			sendError(w, http.StatusNotFound, "Reseller not found")
			return
		}
		log.Error().Err(err).Msg("Failed to update reseller status")
		sendError(w, http.StatusInternalServerError, "Failed to update status")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Status updated successfully"})
}

// ========== Price Management ==========

type SetPriceRequest struct {
	VoucherPackageID string  `json:"voucher_package_id"`
	ResellerPrice    float64 `json:"reseller_price"`
	RetailPrice      float64 `json:"retail_price"`
}

func (h *ResellerHandler) SetPrice(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	resellerID, err := uuid.Parse(getPathParam(r, "reseller_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid reseller_id")
		return
	}

	var req SetPriceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	packageID, err := uuid.Parse(req.VoucherPackageID)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid voucher_package_id")
		return
	}

	if req.ResellerPrice < 0 || req.RetailPrice < 0 || req.RetailPrice < req.ResellerPrice {
		sendError(w, http.StatusBadRequest, "Invalid pricing")
		return
	}

	price, err := h.svc.SetResellerPrice(r.Context(), tenantID, resellerID, packageID, req.ResellerPrice, req.RetailPrice)
	if err != nil {
		if err == service.ErrResellerNotFound {
			sendError(w, http.StatusNotFound, "Reseller not found")
			return
		}
		log.Error().Err(err).Msg("Failed to set reseller price")
		sendError(w, http.StatusInternalServerError, "Failed to set price")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data": price,
	})
}

func (h *ResellerHandler) GetPrices(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	resellerID, err := uuid.Parse(getPathParam(r, "reseller_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid reseller_id")
		return
	}

	prices, err := h.svc.GetResellerPrices(r.Context(), tenantID, resellerID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get reseller prices")
		sendError(w, http.StatusInternalServerError, "Failed to get prices")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data": prices,
	})
}

func (h *ResellerHandler) DeletePrice(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	priceID, err := uuid.Parse(getPathParam(r, "price_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid price_id")
		return
	}

	if err := h.svc.DeleteResellerPrice(r.Context(), tenantID, priceID); err != nil {
		if err == repository.ErrResellerPriceNotFound {
			sendError(w, http.StatusNotFound, "Price not found")
			return
		}
		log.Error().Err(err).Msg("Failed to delete reseller price")
		sendError(w, http.StatusInternalServerError, "Failed to delete price")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Price deleted successfully"})
}

// ========== Global Pricing (Default for all resellers) ==========

func (h *ResellerHandler) SetGlobalPrice(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var req SetPriceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	packageID, err := uuid.Parse(req.VoucherPackageID)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid voucher_package_id")
		return
	}

	price, err := h.svc.SetGlobalPrice(r.Context(), tenantID, packageID, req.ResellerPrice, req.RetailPrice)
	if err != nil {
		log.Error().Err(err).Msg("Failed to set global reseller price")
		sendError(w, http.StatusInternalServerError, "Failed to set global price")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data": price,
	})
}

func (h *ResellerHandler) GetGlobalPrices(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	prices, err := h.svc.GetGlobalPrices(r.Context(), tenantID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get global prices")
		sendError(w, http.StatusInternalServerError, "Failed to get global prices")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data": prices,
	})
}

// ========== Promo Code Management ==========

type CreatePromoRequest struct {
	Code          string  `json:"code"`
	RuleName      string  `json:"rule_name"`
	DiscountType  string  `json:"discount_type"`
	DiscountValue float64 `json:"discount_value"`
	ExpiresAt     *string `json:"expires_at,omitempty"`
	DiscountID    *string `json:"discount_id,omitempty"`
}

func (h *ResellerHandler) CreatePromo(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var req CreatePromoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Code == "" || req.RuleName == "" {
		sendError(w, http.StatusBadRequest, "Code and rule name are required")
		return
	}

	discountType := reseller.DiscountType(req.DiscountType)
	if discountType != reseller.DiscountTypeFixed && discountType != reseller.DiscountTypePercentage {
		sendError(w, http.StatusBadRequest, "Invalid discount type (must be 'fixed' or 'percentage')")
		return
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		// Try ISO format first
		t, err := time.Parse(time.RFC3339, *req.ExpiresAt)
		if err != nil {
			// Try YYYY-MM-DD format
			t, err = time.Parse("2006-01-02", *req.ExpiresAt)
			if err != nil {
				sendError(w, http.StatusBadRequest, "Invalid expires_at format, use YYYY-MM-DD or ISO8601")
				return
			}
		}
		expiresAt = &t
	}

	var discountID *uuid.UUID
	if req.DiscountID != nil {
		id, err := uuid.Parse(*req.DiscountID)
		if err != nil {
			sendError(w, http.StatusBadRequest, "Invalid discount_id")
			return
		}
		discountID = &id
	}

	promo, err := h.svc.CreatePromoCode(r.Context(), tenantID, req.Code, req.RuleName, discountType, req.DiscountValue, expiresAt, discountID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create promo code")
		sendError(w, http.StatusInternalServerError, "Failed to create promo code")
		return
	}

	sendJSON(w, http.StatusCreated, map[string]interface{}{
		"data": promo,
	})
}

func (h *ResellerHandler) ListPromos(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	promos, err := h.svc.ListPromoCodes(r.Context(), tenantID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list promo codes")
		sendError(w, http.StatusInternalServerError, "Failed to list promo codes")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data": promos,
	})
}

func (h *ResellerHandler) TogglePromoStatus(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	promoID, err := uuid.Parse(getPathParam(r, "promo_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid promo_id")
		return
	}

	if err := h.svc.TogglePromoCodeStatus(r.Context(), tenantID, promoID); err != nil {
		log.Error().Err(err).Msg("Failed to toggle promo status")
		sendError(w, http.StatusInternalServerError, "Failed to toggle status")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Status toggled successfully"})
}

func (h *ResellerHandler) DeletePromo(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	promoID, err := uuid.Parse(getPathParam(r, "promo_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid promo_id")
		return
	}

	if err := h.svc.DeletePromoCode(r.Context(), tenantID, promoID); err != nil {
		log.Error().Err(err).Msg("Failed to delete promo code")
		sendError(w, http.StatusInternalServerError, "Failed to delete promo code")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Promo code deleted successfully"})
}

// ========== Purchase Management ==========

type ProcessPurchaseRequest struct {
	VoucherPackageID string  `json:"voucher_package_id"`
	RouterID         *string `json:"router_id,omitempty"`
	Quantity         int     `json:"quantity"`
	PaymentMethod    string  `json:"payment_method"`
	PromoCode        *string `json:"promo_code,omitempty"`
}

func (h *ResellerHandler) ProcessPurchase(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	resellerID, err := uuid.Parse(getPathParam(r, "reseller_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid reseller_id")
		return
	}

	var req ProcessPurchaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	packageID, err := uuid.Parse(req.VoucherPackageID)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid voucher_package_id")
		return
	}

	if req.Quantity < 1 {
		sendError(w, http.StatusBadRequest, "Quantity must be at least 1")
		return
	}

	var routerID *uuid.UUID
	if req.RouterID != nil {
		id, err := uuid.Parse(*req.RouterID)
		if err != nil {
			sendError(w, http.StatusBadRequest, "Invalid router_id")
			return
		}
		routerID = &id
	}

	purchase, err := h.svc.ProcessPurchase(r.Context(), tenantID, resellerID, packageID, routerID, req.Quantity, req.PaymentMethod, req.PromoCode)
	if err != nil {
		switch err {
		case service.ErrResellerNotFound:
			sendError(w, http.StatusNotFound, "Reseller not found")
		case service.ErrInvalidDiscount:
			sendError(w, http.StatusBadRequest, "Invalid promo code")
		case service.ErrDiscountInactive:
			sendError(w, http.StatusBadRequest, "Promo code is inactive")
		case service.ErrResellerDiscountExpired:
			sendError(w, http.StatusBadRequest, "Promo code has expired")
		default:
			log.Error().Err(err).Msg("Failed to process purchase")
			sendError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to process purchase: %s", err.Error()))
		}
		return
	}

	sendJSON(w, http.StatusCreated, map[string]interface{}{
		"data": purchase,
	})
}

func (h *ResellerHandler) GetPurchaseHistory(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	var filter reseller.PurchaseListFilter

	if resellerID := r.URL.Query().Get("reseller_id"); resellerID != "" {
		id, err := uuid.Parse(resellerID)
		if err == nil {
			filter.ResellerID = &id
		}
	}

	if status := r.URL.Query().Get("status"); status != "" {
		s := reseller.PurchaseStatus(status)
		filter.Status = &s
	}

	if page := r.URL.Query().Get("page"); page != "" {
		if p, err := strconv.Atoi(page); err == nil {
			filter.Page = p
		}
	}

	if pageSize := r.URL.Query().Get("page_size"); pageSize != "" {
		if ps, err := strconv.Atoi(pageSize); err == nil {
			filter.PageSize = ps
		}
	}

	purchases, total, err := h.svc.GetPurchaseHistory(r.Context(), tenantID, filter)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get purchase history")
		sendError(w, http.StatusInternalServerError, "Failed to get purchase history")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data":  purchases,
		"total": total,
		"page":  filter.Page,
	})
}

func (h *ResellerHandler) GetPurchase(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	purchaseID, err := uuid.Parse(getPathParam(r, "purchase_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid purchase_id")
		return
	}

	purchase, err := h.svc.GetPurchaseByID(r.Context(), tenantID, purchaseID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get purchase")
		sendError(w, http.StatusInternalServerError, "Failed to get purchase")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{"data": purchase})
}

func (h *ResellerHandler) ConfirmPurchase(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	purchaseID, err := uuid.Parse(getPathParam(r, "purchase_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid purchase_id")
		return
	}

	purchase, err := h.svc.ConfirmPurchase(r.Context(), tenantID, purchaseID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to confirm purchase")
		sendError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to confirm purchase: %s", err.Error()))
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data":    purchase,
		"message": "Purchase confirmed and vouchers generated",
	})
}

func (h *ResellerHandler) DeletePurchase(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	purchaseID, err := uuid.Parse(getPathParam(r, "purchase_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid purchase_id")
		return
	}

	if err := h.svc.DeletePurchase(r.Context(), tenantID, purchaseID); err != nil {
		log.Error().Err(err).Msg("Failed to delete purchase record")
		sendError(w, http.StatusInternalServerError, "Failed to delete purchase record")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Purchase history and vouchers deleted successfully"})
}

func (h *ResellerHandler) DeleteReseller(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	resellerID, err := uuid.Parse(getPathParam(r, "reseller_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid reseller_id")
		return
	}

	if err := h.svc.DeleteReseller(r.Context(), tenantID, resellerID); err != nil {
		if err == service.ErrResellerNotFound {
			sendError(w, http.StatusNotFound, "Reseller not found")
			return
		}
		log.Error().Err(err).Msg("Failed to delete reseller")
		sendError(w, http.StatusInternalServerError, "Failed to delete reseller")
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Reseller and all associated data deleted successfully"})
}

func (h *ResellerHandler) CountActiveVouchers(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	resellerID, err := uuid.Parse(getPathParam(r, "reseller_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid reseller_id")
		return
	}

	count, err := h.svc.CountActiveVouchers(r.Context(), tenantID, resellerID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to count active vouchers")
		sendError(w, http.StatusInternalServerError, "Failed to count active vouchers")
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{"data": count})
}

func (h *ResellerHandler) SubmitPayment(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == (uuid.UUID{}) {
		sendError(w, http.StatusBadRequest, "No tenant context")
		return
	}

	purchaseID, err := uuid.Parse(getPathParam(r, "purchase_id"))
	if err != nil {
		sendError(w, http.StatusBadRequest, "Invalid purchase_id")
		return
	}

	purchase, err := h.svc.SubmitPayment(r.Context(), tenantID, purchaseID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to submit payment")
		sendError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to submit payment: %s", err.Error()))
		return
	}

	sendJSON(w, http.StatusOK, map[string]interface{}{
		"data":    purchase,
		"message": "Payment notification submitted successfully",
	})
}
