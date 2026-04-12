package handler

import (
	"encoding/json"
	"net/http"
	"rrnet/internal/auth"
	"rrnet/internal/service"
	"github.com/google/uuid"
	"strings"
)

type VoucherDesignHandler struct {
	service *service.VoucherDesignService
}

func NewVoucherDesignHandler(s *service.VoucherDesignService) *VoucherDesignHandler {
	return &VoucherDesignHandler{service: s}
}

func (h *VoucherDesignHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	designs, err := h.service.ListAll(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(designs)
}

func (h *VoucherDesignHandler) ListOwned(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.GetClaims(r.Context())
	designs, err := h.service.ListOwned(r.Context(), claims.TenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(designs)
}

func (h *VoucherDesignHandler) Purchase(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.GetClaims(r.Context())
	
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/voucher-designs/")
	idStr := strings.TrimSuffix(path, "/purchase")
	
	designID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid design id", http.StatusBadRequest)
		return
	}

	err = h.service.Purchase(r.Context(), claims.TenantID, designID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "purchase successful"})
}

func (h *VoucherDesignHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.GetClaims(r.Context())

	var req struct {
		DefaultSlugs  []string `json:"default_voucher_design_slug"`
		ResellerSlugs []string `json:"reseller_voucher_design_slug"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	defaultStr := strings.Join(req.DefaultSlugs, ",")
	resellerStr := strings.Join(req.ResellerSlugs, ",")

	err := h.service.UpdateGlobalSettings(r.Context(), claims.TenantID, defaultStr, resellerStr)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "settings updated successfully"})
}
