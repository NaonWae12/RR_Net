package repository

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/wa_log"
)

type WALogRepository struct {
	db *pgxpool.Pool
}

func NewWALogRepository(db *pgxpool.Pool) *WALogRepository {
	return &WALogRepository{db: db}
}

func (r *WALogRepository) Create(ctx context.Context, log *wa_log.MessageLog) (*wa_log.MessageLog, error) {
	q := `
		INSERT INTO wa_message_logs (
			id, tenant_id, source,
			campaign_id, campaign_recipient_id,
			client_id, client_name,
			to_phone, message_text, template_id,
			status, gateway_message_id, error, created_at, sent_at
		) VALUES (
			$1,$2,$3,
			$4,$5,
			$6,$7,
			$8,$9,$10,
			$11,$12,$13,$14,$15
		)
		RETURNING id, tenant_id, source, campaign_id, campaign_recipient_id, client_id, client_name,
		          to_phone, message_text, template_id, status, gateway_message_id, error, created_at, sent_at
	`
	var out wa_log.MessageLog
	err := r.db.QueryRow(ctx, q,
		log.ID, log.TenantID, log.Source,
		log.CampaignID, log.CampaignRecipientID,
		log.ClientID, log.ClientName,
		log.ToPhone, log.MessageText, log.TemplateID,
		log.Status, log.GatewayMessageID, log.Error, log.CreatedAt, log.SentAt,
	).Scan(
		&out.ID, &out.TenantID, &out.Source, &out.CampaignID, &out.CampaignRecipientID,
		&out.ClientID, &out.ClientName,
		&out.ToPhone, &out.MessageText, &out.TemplateID,
		&out.Status, &out.GatewayMessageID, &out.Error, &out.CreatedAt, &out.SentAt,
	)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (r *WALogRepository) MarkSent(ctx context.Context, tenantID, id uuid.UUID, gatewayMessageID *string) error {
	q := `
		UPDATE wa_message_logs
		SET status = 'sent', gateway_message_id = $3, error = NULL, sent_at = NOW()
		WHERE id = $1 AND tenant_id = $2
	`
	_, err := r.db.Exec(ctx, q, id, tenantID, gatewayMessageID)
	return err
}

func (r *WALogRepository) MarkFailed(ctx context.Context, tenantID, id uuid.UUID, errMsg string) error {
	q := `
		UPDATE wa_message_logs
		SET status = 'failed', error = $3, sent_at = NOW()
		WHERE id = $1 AND tenant_id = $2
	`
	_, err := r.db.Exec(ctx, q, id, tenantID, errMsg)
	return err
}

type WALogListFilter struct {
	Search     string
	Status     *wa_log.Status
	Source     *wa_log.Source
	CampaignID *uuid.UUID
	Limit      int
	Cursor     *WALogCursor
}

// WALogCursor implements a stable cursor for descending (created_at, id).
// It is encoded as a URL-safe string: <RFC3339Nano>|<uuid>
type WALogCursor struct {
	CreatedAt time.Time
	ID        uuid.UUID
}

func ParseWALogCursor(v string) (*WALogCursor, error) {
	v, _ = url.QueryUnescape(strings.TrimSpace(v))
	if v == "" {
		return nil, nil
	}
	parts := strings.Split(v, "|")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid cursor format")
	}
	ts, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return nil, fmt.Errorf("invalid cursor timestamp")
	}
	id, err := uuid.Parse(parts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid cursor id")
	}
	return &WALogCursor{CreatedAt: ts, ID: id}, nil
}

func (c *WALogCursor) String() string {
	return url.QueryEscape(c.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + c.ID.String())
}

func ParseLimit(v string, def int, max int) int {
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return def
	}
	if n > max {
		return max
	}
	return n
}

func (r *WALogRepository) List(ctx context.Context, tenantID uuid.UUID, filter *WALogListFilter) ([]*wa_log.MessageLog, *WALogCursor, error) {
	if filter == nil {
		filter = &WALogListFilter{}
	}
	limit := filter.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	where := `WHERE tenant_id = $1`
	args := []any{tenantID}
	argN := 2

	if filter.Source != nil {
		where += fmt.Sprintf(` AND source = $%d`, argN)
		args = append(args, string(*filter.Source))
		argN++
	}
	if filter.Status != nil {
		where += fmt.Sprintf(` AND status = $%d`, argN)
		args = append(args, string(*filter.Status))
		argN++
	}
	if filter.CampaignID != nil {
		where += fmt.Sprintf(` AND campaign_id = $%d`, argN)
		args = append(args, *filter.CampaignID)
		argN++
	}
	if s := strings.TrimSpace(filter.Search); s != "" {
		where += fmt.Sprintf(` AND (to_phone ILIKE $%d OR COALESCE(client_name,'') ILIKE $%d)`, argN, argN)
		args = append(args, "%"+s+"%")
		argN++
	}
	if filter.Cursor != nil {
		// created_at DESC, id DESC pagination
		where += fmt.Sprintf(` AND (created_at, id) < ($%d, $%d)`, argN, argN+1)
		args = append(args, filter.Cursor.CreatedAt, filter.Cursor.ID)
		argN += 2
	}

	q := `
		SELECT id, tenant_id, source, campaign_id, campaign_recipient_id, client_id, client_name,
		       to_phone, message_text, template_id, status, gateway_message_id, error, created_at, sent_at
		FROM wa_message_logs
		` + where + `
		ORDER BY created_at DESC, id DESC
		LIMIT ` + fmt.Sprintf("$%d", argN)
	args = append(args, limit)

	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var out []*wa_log.MessageLog
	for rows.Next() {
		var m wa_log.MessageLog
		var source string
		var status string
		if err := rows.Scan(
			&m.ID, &m.TenantID, &source, &m.CampaignID, &m.CampaignRecipientID,
			&m.ClientID, &m.ClientName,
			&m.ToPhone, &m.MessageText, &m.TemplateID,
			&status, &m.GatewayMessageID, &m.Error,
			&m.CreatedAt, &m.SentAt,
		); err != nil {
			return nil, nil, err
		}
		m.Source = wa_log.Source(source)
		m.Status = wa_log.Status(status)
		out = append(out, &m)
	}

	if len(out) == 0 {
		return out, nil, nil
	}
	last := out[len(out)-1]
	next := &WALogCursor{CreatedAt: last.CreatedAt, ID: last.ID}
	return out, next, nil
}

var ErrWALogInvalidCursor = errors.New("invalid cursor")
var ErrWALogNotFound = errors.New("wa log not found")

func (r *WALogRepository) GetByID(ctx context.Context, tenantID, id uuid.UUID) (*wa_log.MessageLog, error) {
	q := `
		SELECT id, tenant_id, source, campaign_id, campaign_recipient_id, client_id, client_name,
		       to_phone, message_text, template_id, status, gateway_message_id, error, created_at, sent_at
		FROM wa_message_logs
		WHERE id = $1 AND tenant_id = $2
	`
	var m wa_log.MessageLog
	var source, status string
	if err := r.db.QueryRow(ctx, q, id, tenantID).Scan(
		&m.ID, &m.TenantID, &source, &m.CampaignID, &m.CampaignRecipientID,
		&m.ClientID, &m.ClientName,
		&m.ToPhone, &m.MessageText, &m.TemplateID,
		&status, &m.GatewayMessageID, &m.Error,
		&m.CreatedAt, &m.SentAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrWALogNotFound
		}
		return nil, err
	}
	m.Source = wa_log.Source(source)
	m.Status = wa_log.Status(status)
	return &m, nil
}


