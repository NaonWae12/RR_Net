package worker

import (
	"context"
	"encoding/json"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/rs/zerolog/log"

	"rrnet/internal/domain/wa_log"
	wagw "rrnet/internal/infra/wa_gateway"
	"rrnet/internal/repository"
	"rrnet/internal/service"
)

type WACampaignWorker struct {
	repo    *repository.WACampaignRepository
	wa      *wagw.Client
	limiter *TenantLimiter
	logSvc  *service.WALogService
}

func NewWACampaignWorker(repo *repository.WACampaignRepository, wa *wagw.Client, limiter *TenantLimiter, logSvc *service.WALogService) *WACampaignWorker {
	if limiter == nil {
		limiter = NewTenantLimiter(1)
	}
	return &WACampaignWorker{repo: repo, wa: wa, limiter: limiter, logSvc: logSvc}
}

func (w *WACampaignWorker) Register(mux *asynq.ServeMux) {
	mux.HandleFunc(service.TaskWACampaignSend, w.handleSend)
}

func (w *WACampaignWorker) handleSend(ctx context.Context, t *asynq.Task) error {
	var p service.WACampaignSendPayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return err
	}

	tenantID, err := uuid.Parse(p.TenantID)
	if err != nil {
		return err
	}
	recipientID, err := uuid.Parse(p.RecipientID)
	if err != nil {
		return err
	}
	campaignID, _ := uuid.Parse(p.CampaignID)

	release := w.limiter.acquire(tenantID.String())
	defer release()

	// Jitter between sends (per task)
	time.Sleep(time.Duration(300+rand.Intn(400)) * time.Millisecond)

	var logID *uuid.UUID
	if w.logSvc != nil {
		cid := campaignID
		rid := recipientID
		l, err := w.logSvc.CreateQueued(ctx, tenantID, service.CreateWALogInput{
			Source:              wa_log.SourceCampaign,
			CampaignID:          &cid,
			CampaignRecipientID: &rid,
			ToPhone:             p.To,
			MessageText:         p.Text,
		})
		if err == nil {
			logID = &l.ID
		}
	}

	res, err := w.wa.Send(ctx, tenantID.String(), p.To, p.Text)
	if err != nil {
		msg := err.Error()
		if w.logSvc != nil && logID != nil {
			_ = w.logSvc.MarkFailed(ctx, tenantID, *logID, msg)
		}
		_, _ = w.repo.MarkRecipientFailed(ctx, recipientID, msg)
		log.Warn().Str("tenant_id", tenantID.String()).Str("recipient_id", recipientID.String()).Err(err).Msg("wa campaign send failed")
		return nil
	}

	if res == nil || !res.OK {
		msg := "wa-gateway reported ok=false"
		if w.logSvc != nil && logID != nil {
			_ = w.logSvc.MarkFailed(ctx, tenantID, *logID, msg)
		}
		_, _ = w.repo.MarkRecipientFailed(ctx, recipientID, msg)
		log.Warn().Str("tenant_id", tenantID.String()).Str("recipient_id", recipientID.String()).Msg("wa campaign send not ok")
		return nil
	}

	if w.logSvc != nil && logID != nil {
		_ = w.logSvc.MarkSent(ctx, tenantID, *logID, res.MessageID)
	}
	_, _ = w.repo.MarkRecipientSent(ctx, recipientID, res.MessageID)
	log.Info().Str("tenant_id", tenantID.String()).Str("recipient_id", recipientID.String()).Msg("wa campaign send ok")
	return nil
}


