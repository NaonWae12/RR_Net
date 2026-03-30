package repository

import (
	"context"
	"rrnet/internal/domain/site_setting"

	"github.com/jackc/pgx/v5/pgxpool"
)

type SiteSettingRepository interface {
	GetByKey(ctx context.Context, key string) (*site_setting.SiteSetting, error)
	Upsert(ctx context.Context, setting *site_setting.SiteSetting) error
	List(ctx context.Context) ([]site_setting.SiteSetting, error)
}

type siteSettingRepository struct {
	db *pgxpool.Pool
}

func NewSiteSettingRepository(db *pgxpool.Pool) SiteSettingRepository {
	return &siteSettingRepository{db: db}
}

func (r *siteSettingRepository) GetByKey(ctx context.Context, key string) (*site_setting.SiteSetting, error) {
	query := `SELECT id, key, value, description, created_at, updated_at FROM site_settings WHERE key = $1`

	var s site_setting.SiteSetting
	err := r.db.QueryRow(ctx, query, key).Scan(&s.ID, &s.Key, &s.Value, &s.Description, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &s, nil
}

func (r *siteSettingRepository) Upsert(ctx context.Context, s *site_setting.SiteSetting) error {
	query := `
		INSERT INTO site_settings (key, value, description, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (key) DO UPDATE SET
			value = EXCLUDED.value,
			description = EXCLUDED.description,
			updated_at = NOW()
		RETURNING id, created_at, updated_at
	`

	return r.db.QueryRow(ctx, query, s.Key, s.Value, s.Description).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *siteSettingRepository) List(ctx context.Context) ([]site_setting.SiteSetting, error) {
	query := `SELECT id, key, value, description, created_at, updated_at FROM site_settings ORDER BY key ASC`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var settings []site_setting.SiteSetting
	for rows.Next() {
		var s site_setting.SiteSetting
		if err := rows.Scan(&s.ID, &s.Key, &s.Value, &s.Description, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		settings = append(settings, s)
	}

	return settings, nil
}
