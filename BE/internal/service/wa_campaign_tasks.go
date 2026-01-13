package service

import (
	"encoding/json"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

const TaskWACampaignSend = "wa:campaign_send"

type WACampaignSendPayload struct {
	TenantID    string `json:"tenant_id"`
	CampaignID  string `json:"campaign_id"`
	RecipientID string `json:"recipient_id"`
	To          string `json:"to"`
	Text        string `json:"text"`
}

func NewWACampaignSendTask(tenantID, campaignID, recipientID uuid.UUID, to, text string) (*asynq.Task, error) {
	p := WACampaignSendPayload{
		TenantID:    tenantID.String(),
		CampaignID:  campaignID.String(),
		RecipientID: recipientID.String(),
		To:          to,
		Text:        text,
	}
	b, err := json.Marshal(p)
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TaskWACampaignSend, b), nil
}


