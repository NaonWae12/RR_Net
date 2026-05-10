package handler

import (
	"encoding/json"
	"net/http"
	"rrnet/internal/domain/site_setting"
	"rrnet/internal/service"
)

type SiteSettingHandler struct {
	service service.SiteSettingService
}

func NewSiteSettingHandler(service service.SiteSettingService) *SiteSettingHandler {
	return &SiteSettingHandler{service: service}
}

func (h *SiteSettingHandler) GetSEO(w http.ResponseWriter, r *http.Request) {
	seo, err := h.service.GetSEO(r.Context())
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.sendJSON(w, http.StatusOK, seo)
}

func (h *SiteSettingHandler) UpdateSEO(w http.ResponseWriter, r *http.Request) {
	var seo site_setting.LandingPageSEO
	if err := json.NewDecoder(r.Body).Decode(&seo); err != nil {
		h.sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.service.UpdateSEO(r.Context(), &seo); err != nil {
		h.sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.sendJSON(w, http.StatusOK, seo)
}

func (h *SiteSettingHandler) GetPricingConfig(w http.ResponseWriter, r *http.Request) {
	config, err := h.service.GetPricingConfig(r.Context())
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.sendJSON(w, http.StatusOK, config)
}

func (h *SiteSettingHandler) UpdatePricingConfig(w http.ResponseWriter, r *http.Request) {
	var config site_setting.LandingPagePricing
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		h.sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.service.UpdatePricingConfig(r.Context(), &config); err != nil {
		h.sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.sendJSON(w, http.StatusOK, config)
}

func (h *SiteSettingHandler) List(w http.ResponseWriter, r *http.Request) {
	settings, err := h.service.ListSettings(r.Context())
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.sendJSON(w, http.StatusOK, settings)
}

func (h *SiteSettingHandler) GetMidtransConfig(w http.ResponseWriter, r *http.Request) {
	config, err := h.service.GetMidtransConfig(r.Context())
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.sendJSON(w, http.StatusOK, config)
}

func (h *SiteSettingHandler) GetPublicMidtransConfig(w http.ResponseWriter, r *http.Request) {
	config, err := h.service.GetMidtransConfig(r.Context())
	if err != nil {
		h.sendError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Mask sensitive data
	publicConfig := map[string]interface{}{
		"enabled":       config.Enabled,
		"client_key":    config.ClientKey,
		"is_production": config.IsProduction,
	}

	h.sendJSON(w, http.StatusOK, publicConfig)
}

func (h *SiteSettingHandler) UpdateMidtransConfig(w http.ResponseWriter, r *http.Request) {
	var config service.MidtransConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		h.sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := h.service.UpdateMidtransConfig(r.Context(), &config); err != nil {
		h.sendError(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.sendJSON(w, http.StatusOK, config)
}

func (h *SiteSettingHandler) sendJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func (h *SiteSettingHandler) sendError(w http.ResponseWriter, status int, message string) {
	h.sendJSON(w, status, map[string]string{
		"error": message,
	})
}
