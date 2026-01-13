package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/wa_log"
	"rrnet/internal/repository"
)

type WALogService struct {
	repo *repository.WALogRepository
}

func NewWALogService(repo *repository.WALogRepository) *WALogService {
	return &WALogService{repo: repo}
}

type CreateWALogInput struct {
	Source wa_log.Source

	CampaignID          *uuid.UUID
	CampaignRecipientID *uuid.UUID

	ClientID   *uuid.UUID
	ClientName *string

	ToPhone     string
	MessageText string
	TemplateID  *uuid.UUID
}

func (s *WALogService) CreateQueued(ctx context.Context, tenantID uuid.UUID, in CreateWALogInput) (*wa_log.MessageLog, error) {
	msg := strings.TrimSpace(in.MessageText)
	to := strings.TrimSpace(in.ToPhone)
	out, err := s.repo.Create(ctx, &wa_log.MessageLog{
		ID:                  uuid.New(),
		TenantID:            tenantID,
		Source:              in.Source,
		CampaignID:          in.CampaignID,
		CampaignRecipientID: in.CampaignRecipientID,
		ClientID:            in.ClientID,
		ClientName:          in.ClientName,
		ToPhone:             to,
		MessageText:         msg,
		TemplateID:          in.TemplateID,
		Status:              wa_log.StatusQueued,
		CreatedAt:           time.Now(),
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (s *WALogService) MarkSent(ctx context.Context, tenantID, id uuid.UUID, gatewayMessageID *string) error {
	return s.repo.MarkSent(ctx, tenantID, id, gatewayMessageID)
}

func (s *WALogService) MarkFailed(ctx context.Context, tenantID, id uuid.UUID, errMsg string) error {
	return s.repo.MarkFailed(ctx, tenantID, id, errMsg)
}


