package service

import (
	"context"
	"errors"
	"math/rand"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"

	asynqInfra "rrnet/internal/infra/asynq"
	"rrnet/internal/domain/wa_campaign"
	"rrnet/internal/repository"
)

var (
	ErrWACampaignNameRequired    = errors.New("campaign name is required")
	ErrWACampaignMessageRequired = errors.New("campaign message is required")
	ErrWACampaignGroupRequired   = errors.New("client group is required")
	ErrWACampaignNoRecipients    = errors.New("no recipients found")
)

type WACampaignService struct {
	campaignRepo *repository.WACampaignRepository
	clientRepo   *repository.ClientRepository
	asynqClient  *asynq.Client
}

func NewWACampaignService(
	campaignRepo *repository.WACampaignRepository,
	clientRepo *repository.ClientRepository,
	asynqClient *asynq.Client,
) *WACampaignService {
	return &WACampaignService{
		campaignRepo: campaignRepo,
		clientRepo:   clientRepo,
		asynqClient:  asynqClient,
	}
}

func (s *WACampaignService) CreateAndEnqueue(ctx context.Context, tenantID uuid.UUID, name, message string, groupID uuid.UUID) (*wa_campaign.Campaign, error) {
	name = strings.TrimSpace(name)
	message = strings.TrimSpace(message)
	if name == "" {
		return nil, ErrWACampaignNameRequired
	}
	if message == "" {
		return nil, ErrWACampaignMessageRequired
	}
	if groupID == uuid.Nil {
		return nil, ErrWACampaignGroupRequired
	}

	clients, err := s.clientRepo.ListByGroupID(ctx, tenantID, groupID)
	if err != nil {
		return nil, err
	}

	var recs []*wa_campaign.Recipient
	for _, c := range clients {
		phone := ""
		if c.Phone != nil {
			phone = strings.TrimSpace(*c.Phone)
		}
		if phone == "" {
			continue
		}
		id := uuid.New()
		clientID := c.ID
		recs = append(recs, &wa_campaign.Recipient{
			ID:         id,
			CampaignID: uuid.Nil, // filled after campaign created
			ClientID:   &clientID,
			Phone:      phone,
			Status:     wa_campaign.RecipientPending,
		})
	}
	if len(recs) == 0 {
		return nil, ErrWACampaignNoRecipients
	}

	camp, err := s.campaignRepo.CreateCampaign(ctx, tenantID, groupID, name, message, len(recs))
	if err != nil {
		return nil, err
	}
	for _, r := range recs {
		r.CampaignID = camp.ID
	}
	if err := s.campaignRepo.InsertRecipients(ctx, camp.ID, recs); err != nil {
		return nil, err
	}

	// Enqueue tasks
	for _, r := range recs {
		task, err := NewWACampaignSendTask(tenantID, camp.ID, r.ID, r.Phone, message)
		if err != nil {
			return nil, err
		}

		// Spread execution slightly to avoid immediate bursts even with concurrency.
		delay := time.Duration(300+rand.Intn(400)) * time.Millisecond
		_, err = s.asynqClient.Enqueue(
			task,
			asynq.Queue(asynqInfra.QueueNotification), // reuse notification queue for now
			asynq.ProcessIn(delay),
			asynq.MaxRetry(3),
			asynq.Timeout(30*time.Second),
		)
		if err != nil {
			return nil, err
		}
	}

	return camp, nil
}

func (s *WACampaignService) List(ctx context.Context, tenantID uuid.UUID) ([]*wa_campaign.Campaign, error) {
	return s.campaignRepo.ListCampaigns(ctx, tenantID, 50)
}

func (s *WACampaignService) Detail(ctx context.Context, tenantID, campaignID uuid.UUID) (*wa_campaign.Campaign, []*wa_campaign.Recipient, error) {
	c, err := s.campaignRepo.GetCampaign(ctx, tenantID, campaignID)
	if err != nil {
		return nil, nil, err
	}
	recs, err := s.campaignRepo.ListRecipients(ctx, tenantID, campaignID, 500)
	if err != nil {
		return nil, nil, err
	}
	return c, recs, nil
}

func (s *WACampaignService) RetryFailed(ctx context.Context, tenantID, campaignID uuid.UUID) (int, error) {
	camp, err := s.campaignRepo.GetCampaign(ctx, tenantID, campaignID)
	if err != nil {
		return 0, err
	}

	failedRecs, err := s.campaignRepo.ListFailedRecipients(ctx, tenantID, campaignID, 5000)
	if err != nil {
		return 0, err
	}
	if len(failedRecs) == 0 {
		return 0, nil
	}

	n, err := s.campaignRepo.ResetFailedRecipients(ctx, tenantID, campaignID)
	if err != nil {
		return 0, err
	}

	for _, r := range failedRecs {
		task, err := NewWACampaignSendTask(tenantID, campaignID, r.ID, r.Phone, camp.Message)
		if err != nil {
			return 0, err
		}
		delay := time.Duration(300+rand.Intn(400)) * time.Millisecond
		_, err = s.asynqClient.Enqueue(task, asynq.Queue(asynqInfra.QueueNotification), asynq.ProcessIn(delay), asynq.MaxRetry(3), asynq.Timeout(30*time.Second))
		if err != nil {
			return 0, err
		}
	}
	return n, nil
}


