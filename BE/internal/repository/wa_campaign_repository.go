package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/wa_campaign"
)

var (
	ErrWACampaignNotFound = errors.New("wa campaign not found")
)

type WACampaignRepository struct {
	db *pgxpool.Pool
}

func NewWACampaignRepository(db *pgxpool.Pool) *WACampaignRepository {
	return &WACampaignRepository{db: db}
}

func (r *WACampaignRepository) CreateCampaign(ctx context.Context, tenantID uuid.UUID, groupID uuid.UUID, name, message string, total int) (*wa_campaign.Campaign, error) {
	q := `
		INSERT INTO wa_campaigns (tenant_id, group_id, name, message, status, total, sent, failed)
		VALUES ($1,$2,$3,$4,'queued',$5,0,0)
		RETURNING id, tenant_id, group_id, name, message, status, total, sent, failed, created_at, updated_at
	`
	var c wa_campaign.Campaign
	if err := r.db.QueryRow(ctx, q, tenantID, groupID, name, message, total).Scan(
		&c.ID, &c.TenantID, &c.GroupID, &c.Name, &c.Message, &c.Status, &c.Total, &c.Sent, &c.Failed, &c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *WACampaignRepository) InsertRecipients(ctx context.Context, campaignID uuid.UUID, recipients []*wa_campaign.Recipient) error {
	if len(recipients) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	q := `
		INSERT INTO wa_campaign_recipients (id, campaign_id, client_id, phone, status)
		VALUES ($1,$2,$3,$4,$5)
	`
	for _, rec := range recipients {
		batch.Queue(q, rec.ID, campaignID, rec.ClientID, rec.Phone, rec.Status)
	}
	br := r.db.SendBatch(ctx, batch)
	defer br.Close()
	for range recipients {
		_, err := br.Exec()
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *WACampaignRepository) ListCampaigns(ctx context.Context, tenantID uuid.UUID, limit int) ([]*wa_campaign.Campaign, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := `
		SELECT id, tenant_id, group_id, name, message, status, total, sent, failed, created_at, updated_at
		FROM wa_campaigns
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := r.db.Query(ctx, q, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*wa_campaign.Campaign
	for rows.Next() {
		var c wa_campaign.Campaign
		if err := rows.Scan(&c.ID, &c.TenantID, &c.GroupID, &c.Name, &c.Message, &c.Status, &c.Total, &c.Sent, &c.Failed, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, &c)
	}
	return out, nil
}

func (r *WACampaignRepository) GetCampaign(ctx context.Context, tenantID, id uuid.UUID) (*wa_campaign.Campaign, error) {
	q := `
		SELECT id, tenant_id, group_id, name, message, status, total, sent, failed, created_at, updated_at
		FROM wa_campaigns
		WHERE id = $1 AND tenant_id = $2
	`
	var c wa_campaign.Campaign
	err := r.db.QueryRow(ctx, q, id, tenantID).Scan(&c.ID, &c.TenantID, &c.GroupID, &c.Name, &c.Message, &c.Status, &c.Total, &c.Sent, &c.Failed, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, ErrWACampaignNotFound
	}
	return &c, nil
}

func (r *WACampaignRepository) ListRecipients(ctx context.Context, tenantID, campaignID uuid.UUID, limit int) ([]*wa_campaign.Recipient, error) {
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	// join tenant scope via wa_campaigns
	q := `
		SELECT r.id, r.campaign_id, r.client_id, COALESCE(cl.name, ''), r.phone, r.status, r.error, r.message_id, r.sent_at, r.created_at
		FROM wa_campaign_recipients r
		JOIN wa_campaigns c ON c.id = r.campaign_id
		LEFT JOIN clients cl ON cl.id = r.client_id
		WHERE r.campaign_id = $1 AND c.tenant_id = $2
		ORDER BY r.created_at ASC
		LIMIT $3
	`
	rows, err := r.db.Query(ctx, q, campaignID, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*wa_campaign.Recipient
	for rows.Next() {
		var rec wa_campaign.Recipient
		if err := rows.Scan(&rec.ID, &rec.CampaignID, &rec.ClientID, &rec.ClientName, &rec.Phone, &rec.Status, &rec.Error, &rec.MessageID, &rec.SentAt, &rec.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, &rec)
	}
	return out, nil
}

func (r *WACampaignRepository) ListFailedRecipients(ctx context.Context, tenantID, campaignID uuid.UUID, limit int) ([]*wa_campaign.Recipient, error) {
	if limit <= 0 || limit > 5000 {
		limit = 5000
	}
	q := `
		SELECT r.id, r.campaign_id, r.client_id, COALESCE(cl.name, ''), r.phone, r.status, r.error, r.message_id, r.sent_at, r.created_at
		FROM wa_campaign_recipients r
		JOIN wa_campaigns c ON c.id = r.campaign_id
		LEFT JOIN clients cl ON cl.id = r.client_id
		WHERE r.campaign_id = $1 AND c.tenant_id = $2 AND r.status = 'failed'
		ORDER BY r.created_at ASC
		LIMIT $3
	`
	rows, err := r.db.Query(ctx, q, campaignID, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*wa_campaign.Recipient
	for rows.Next() {
		var rec wa_campaign.Recipient
		if err := rows.Scan(&rec.ID, &rec.CampaignID, &rec.ClientID, &rec.ClientName, &rec.Phone, &rec.Status, &rec.Error, &rec.MessageID, &rec.SentAt, &rec.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, &rec)
	}
	return out, nil
}

func (r *WACampaignRepository) MarkRecipientSent(ctx context.Context, recipientID uuid.UUID, messageID *string) (uuid.UUID, error) {
	var campaignID uuid.UUID
	q := `
		UPDATE wa_campaign_recipients
		SET status='sent', error=NULL, message_id=$2, sent_at=NOW()
		WHERE id=$1
		RETURNING campaign_id
	`
	if err := r.db.QueryRow(ctx, q, recipientID, messageID).Scan(&campaignID); err != nil {
		return uuid.Nil, err
	}

	// increment counters + set running
	_, _ = r.db.Exec(ctx, `UPDATE wa_campaigns SET sent = sent + 1, status='running', updated_at=NOW() WHERE id=$1`, campaignID)
	_, _ = r.db.Exec(ctx, `UPDATE wa_campaigns SET status='completed', updated_at=NOW() WHERE id=$1 AND (sent + failed) >= total AND status IN ('queued','running')`, campaignID)
	return campaignID, nil
}

func (r *WACampaignRepository) MarkRecipientFailed(ctx context.Context, recipientID uuid.UUID, errMsg string) (uuid.UUID, error) {
	var campaignID uuid.UUID
	q := `
		UPDATE wa_campaign_recipients
		SET status='failed', error=$2, sent_at=NOW()
		WHERE id=$1
		RETURNING campaign_id
	`
	if err := r.db.QueryRow(ctx, q, recipientID, errMsg).Scan(&campaignID); err != nil {
		return uuid.Nil, err
	}
	_, _ = r.db.Exec(ctx, `UPDATE wa_campaigns SET failed = failed + 1, status='running', updated_at=NOW() WHERE id=$1`, campaignID)
	_, _ = r.db.Exec(ctx, `UPDATE wa_campaigns SET status='completed', updated_at=NOW() WHERE id=$1 AND (sent + failed) >= total AND status IN ('queued','running')`, campaignID)
	return campaignID, nil
}

func (r *WACampaignRepository) ResetFailedRecipients(ctx context.Context, tenantID, campaignID uuid.UUID) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// tenant scope check
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT true FROM wa_campaigns WHERE id=$1 AND tenant_id=$2`, campaignID, tenantID).Scan(&exists); err != nil {
		return 0, ErrWACampaignNotFound
	}

	ct, err := tx.Exec(ctx, `
		UPDATE wa_campaign_recipients
		SET status='pending', error=NULL, message_id=NULL, sent_at=NULL
		WHERE campaign_id=$1 AND status='failed'
	`, campaignID)
	if err != nil {
		return 0, err
	}
	n := int(ct.RowsAffected())
	if n == 0 {
		_ = tx.Commit(ctx)
		return 0, nil
	}

	_, _ = tx.Exec(ctx, `
		UPDATE wa_campaigns
		SET failed = GREATEST(failed - $2, 0),
		    status = 'running',
		    updated_at = NOW()
		WHERE id=$1
	`, campaignID, n)

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return n, nil
}


