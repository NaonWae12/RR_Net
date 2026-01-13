package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"rrnet/internal/auth"
	"rrnet/internal/domain/wa_log"
	wagw "rrnet/internal/infra/wa_gateway"
	"rrnet/internal/service"
)

type WAGatewayHandler struct {
	client *wagw.Client
	logSvc *service.WALogService
}

func NewWAGatewayHandler(client *wagw.Client, logSvc *service.WALogService) *WAGatewayHandler {
	return &WAGatewayHandler{client: client, logSvc: logSvc}
}

func (h *WAGatewayHandler) Connect(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	// Optional: record a system log entry for audit.
	var logID *uuid.UUID
	if h.logSvc != nil {
		l, err := h.logSvc.CreateQueued(r.Context(), tenantID, service.CreateWALogInput{
			Source:      wa_log.SourceSystem,
			ToPhone:     "-",
			MessageText: "wa-gateway connect requested",
		})
		if err == nil {
			logID = &l.ID
		}
	}

	out, err := h.client.Connect(r.Context(), tenantID.String())
	if err != nil {
		if h.logSvc != nil && logID != nil {
			_ = h.logSvc.MarkFailed(r.Context(), tenantID, *logID, err.Error())
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadGateway)
		return
	}
	if h.logSvc != nil && logID != nil {
		_ = h.logSvc.MarkSent(r.Context(), tenantID, *logID, nil)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

func (h *WAGatewayHandler) Status(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	out, err := h.client.Status(r.Context(), tenantID.String())
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

func (h *WAGatewayHandler) QR(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	out, err := h.client.QR(r.Context(), tenantID.String())
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

func (h *WAGatewayHandler) Send(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := auth.GetTenantID(r.Context())
	if !ok || tenantID == uuid.Nil {
		http.Error(w, `{"error":"No tenant context"}`, http.StatusBadRequest)
		return
	}

	var req struct {
		To         string  `json:"to"`
		Text       string  `json:"text"`
		ClientID   *string `json:"client_id,omitempty"`
		ClientName *string `json:"client_name,omitempty"`
		TemplateID *string `json:"template_id,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid JSON body"}`, http.StatusBadRequest)
		return
	}
	req.To = strings.TrimSpace(req.To)
	req.Text = strings.TrimSpace(req.Text)
	if req.To == "" || req.Text == "" {
		http.Error(w, `{"error":"to and text are required"}`, http.StatusBadRequest)
		return
	}

	var clientID *uuid.UUID
	if req.ClientID != nil && strings.TrimSpace(*req.ClientID) != "" {
		id, err := uuid.Parse(strings.TrimSpace(*req.ClientID))
		if err == nil {
			clientID = &id
		}
	}
	var templateID *uuid.UUID
	if req.TemplateID != nil && strings.TrimSpace(*req.TemplateID) != "" {
		id, err := uuid.Parse(strings.TrimSpace(*req.TemplateID))
		if err == nil {
			templateID = &id
		}
	}
	var clientName *string
	if req.ClientName != nil && strings.TrimSpace(*req.ClientName) != "" {
		s := strings.TrimSpace(*req.ClientName)
		clientName = &s
	}

	var logID *uuid.UUID
	if h.logSvc != nil {
		l, err := h.logSvc.CreateQueued(r.Context(), tenantID, service.CreateWALogInput{
			Source:      wa_log.SourceSingle,
			ClientID:    clientID,
			ClientName:  clientName,
			ToPhone:     req.To,
			MessageText: req.Text,
			TemplateID:  templateID,
		})
		if err == nil {
			logID = &l.ID
		}
	}

	out, err := h.client.Send(r.Context(), tenantID.String(), req.To, req.Text)
	if err != nil {
		if h.logSvc != nil && logID != nil {
			_ = h.logSvc.MarkFailed(r.Context(), tenantID, *logID, err.Error())
		}
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadGateway)
		return
	}
	if out == nil || !out.OK {
		if h.logSvc != nil && logID != nil {
			_ = h.logSvc.MarkFailed(r.Context(), tenantID, *logID, "wa-gateway reported ok=false")
		}
		http.Error(w, `{"error":"wa-gateway reported ok=false"}`, http.StatusBadGateway)
		return
	}
	if h.logSvc != nil && logID != nil {
		_ = h.logSvc.MarkSent(r.Context(), tenantID, *logID, out.MessageID)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}


