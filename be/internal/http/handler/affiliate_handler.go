package handler

import (
	"encoding/json"
	"net/http"

	"rrnet/internal/auth"
	"rrnet/internal/domain/affiliate"
	"rrnet/internal/service"

	"github.com/google/uuid"
)

type AffiliateHandler struct {
	affiliateService *service.AffiliateService
}

func NewAffiliateHandler(affiliateService *service.AffiliateService) *AffiliateHandler {
	return &AffiliateHandler{affiliateService: affiliateService}
}

// Register handles POST /api/v1/affiliate/register
func (h *AffiliateHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req service.RegisterAffiliateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Format request tidak valid")
		return
	}

	aff, err := h.affiliateService.Register(r.Context(), &req)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, aff)
}

// JoinProgram handles POST /api/v1/my/affiliate-join
func (h *AffiliateHandler) JoinProgram(w http.ResponseWriter, r *http.Request) {
	// Get User ID from JWT context
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Token tidak valid atau kadaluarsa")
		return
	}

	aff, err := h.affiliateService.JoinProgram(r.Context(), userID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, aff)
}

// GetMyStatus handles GET /api/v1/my/affiliate-status
func (h *AffiliateHandler) GetMyStatus(w http.ResponseWriter, r *http.Request) {
	// Get User ID from JWT context
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Token tidak valid atau kadaluarsa")
		return
	}

	data, err := h.affiliateService.GetMyStatus(r.Context(), userID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, data)
}

// GetDashboard handles GET /api/v1/affiliate/dashboard
func (h *AffiliateHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	// Get User ID from JWT context
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Token tidak valid atau kadaluarsa")
		return
	}

	data, err := h.affiliateService.GetDashboard(r.Context(), userID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, data)
}

// ListAll handles GET /api/v1/superadmin/affiliates
func (h *AffiliateHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	affiliates, err := h.affiliateService.ListAll(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sendJSON(w, http.StatusOK, affiliates)
}

// GetGlobalStats handles GET /api/v1/superadmin/affiliates/stats
func (h *AffiliateHandler) GetGlobalStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.affiliateService.GetGlobalStats(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sendJSON(w, http.StatusOK, stats)
}

// UpdateStatus handles PATCH /api/v1/superadmin/affiliates/:id/status
func (h *AffiliateHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID tidak valid")
		return
	}

	var req struct {
		Status string `json:"status" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	if err := h.affiliateService.UpdateStatus(r.Context(), id, req.Status); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Status berhasil diperbarui"})
}

// GetSettings handles GET /api/v1/superadmin/affiliates/settings
func (h *AffiliateHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.affiliateService.GetSettings(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sendJSON(w, http.StatusOK, settings)
}

// UpdateSettings handles PATCH /api/v1/superadmin/affiliates/settings
func (h *AffiliateHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req service.AffiliateTierSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Format request tidak valid")
		return
	}

	if err := h.affiliateService.UpdateSettings(r.Context(), &req); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Pengaturan affiliate berhasil diperbarui"})
}

// CreateWithdrawal handles POST /api/v1/affiliate/withdrawals
func (h *AffiliateHandler) CreateWithdrawal(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Token tidak valid")
		return
	}

	var req struct {
		Amount        float64 `json:"amount"`
		BankName      string  `json:"bank_name"`
		AccountNumber string  `json:"account_number"`
		AccountName   string  `json:"account_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	if err := h.affiliateService.CreateWithdrawal(r.Context(), userID, req.Amount, req.BankName, req.AccountNumber, req.AccountName); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, map[string]string{"message": "Permintaan penarikan berhasil diajukan"})
}

// GetWithdrawals handles GET /api/v1/affiliate/withdrawals
func (h *AffiliateHandler) GetWithdrawals(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Token tidak valid")
		return
	}

	withdrawals, err := h.affiliateService.GetWithdrawals(r.Context(), userID)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, withdrawals)
}

// UpdateMetadata handles PATCH /api/v1/affiliate/profile/metadata
func (h *AffiliateHandler) UpdateMetadata(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.GetUserID(r.Context())
	if !ok {
		sendError(w, http.StatusUnauthorized, "Token tidak valid")
		return
	}

	var metadata map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&metadata); err != nil {
		sendError(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	if err := h.affiliateService.UpdateProfileMetadata(r.Context(), userID, metadata); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Profil berhasil diperbarui"})
}

// ListCampaigns handles GET /api/v1/superadmin/affiliates/campaigns
func (h *AffiliateHandler) ListCampaigns(w http.ResponseWriter, r *http.Request) {
	campaigns, err := h.affiliateService.ListCampaigns(r.Context())
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	sendJSON(w, http.StatusOK, campaigns)
}

// CreateCampaign handles POST /api/v1/superadmin/affiliates/campaigns
func (h *AffiliateHandler) CreateCampaign(w http.ResponseWriter, r *http.Request) {
	var c affiliate.Campaign
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		sendError(w, http.StatusBadRequest, "Format request tidak valid")
		return
	}

	if err := h.affiliateService.CreateCampaign(r.Context(), &c); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusCreated, c)
}

// UpdateCampaign handles PATCH /api/v1/superadmin/affiliates/campaigns/:id
func (h *AffiliateHandler) UpdateCampaign(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID tidak valid")
		return
	}

	var c affiliate.Campaign
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		sendError(w, http.StatusBadRequest, "Format request tidak valid")
		return
	}
	c.ID = id

	if err := h.affiliateService.UpdateCampaign(r.Context(), &c); err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, map[string]string{"message": "Strategi berhasil diperbarui"})
}

// GetCampaign handles GET /api/v1/superadmin/affiliates/campaigns/:id
func (h *AffiliateHandler) GetCampaign(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID tidak valid")
		return
	}

	c, err := h.affiliateService.GetCampaign(r.Context(), id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, c)
}

// GetDetail handles GET /api/v1/superadmin/affiliates/:id
func (h *AffiliateHandler) GetDetail(w http.ResponseWriter, r *http.Request) {
	idStr := getPathParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		sendError(w, http.StatusBadRequest, "ID tidak valid")
		return
	}

	data, err := h.affiliateService.GetByIDDetail(r.Context(), id)
	if err != nil {
		sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sendJSON(w, http.StatusOK, data)
}
