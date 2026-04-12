package repository

import (
	"context"
	"rrnet/internal/domain/voucher"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type VoucherDesignRepository struct {
	db *pgxpool.Pool
}

func NewVoucherDesignRepository(db *pgxpool.Pool) *VoucherDesignRepository {
	return &VoucherDesignRepository{db: db}
}

func (r *VoucherDesignRepository) List(ctx context.Context) ([]*voucher.VoucherDesign, error) {
	query := `
		SELECT id, slug, name, COALESCE(description, ''), COALESCE(preview_url, ''), price, is_free, is_active, created_at, updated_at
		FROM voucher_designs
		WHERE is_active = true
		ORDER BY price ASC, name ASC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var designs []*voucher.VoucherDesign
	for rows.Next() {
		var d voucher.VoucherDesign
		err := rows.Scan(&d.ID, &d.Slug, &d.Name, &d.Description, &d.PreviewURL, &d.Price, &d.IsFree, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
		if err != nil {
			return nil, err
		}
		designs = append(designs, &d)
	}
	return designs, nil
}

func (r *VoucherDesignRepository) ListOwnedByTenant(ctx context.Context, tenantID uuid.UUID) ([]*voucher.VoucherDesign, error) {
	query := `
		SELECT d.id, d.slug, d.name, COALESCE(d.description, ''), COALESCE(d.preview_url, ''), d.price, d.is_free, d.is_active, d.created_at, d.updated_at
		FROM voucher_designs d
		JOIN tenant_designs td ON d.id = td.design_id
		WHERE td.tenant_id = $1
		UNION
		SELECT id, slug, name, COALESCE(description, ''), COALESCE(preview_url, ''), price, is_free, is_active, created_at, updated_at
		FROM voucher_designs
		WHERE is_free = true AND is_active = true
		ORDER BY name ASC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var designs []*voucher.VoucherDesign
	for rows.Next() {
		var d voucher.VoucherDesign
		err := rows.Scan(&d.ID, &d.Slug, &d.Name, &d.Description, &d.PreviewURL, &d.Price, &d.IsFree, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
		if err != nil {
			return nil, err
		}
		designs = append(designs, &d)
	}
	return designs, nil
}

func (r *VoucherDesignRepository) Purchase(ctx context.Context, tenantID uuid.UUID, designID uuid.UUID) error {
	query := `
		INSERT INTO tenant_designs (tenant_id, design_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`
	_, err := r.db.Exec(ctx, query, tenantID, designID)
	return err
}

func (r *VoucherDesignRepository) GetByID(ctx context.Context, id uuid.UUID) (*voucher.VoucherDesign, error) {
	query := `
		SELECT id, slug, name, COALESCE(description, ''), COALESCE(preview_url, ''), price, is_free, is_active, created_at, updated_at
		FROM voucher_designs
		WHERE id = $1
	`
	var d voucher.VoucherDesign
	err := r.db.QueryRow(ctx, query, id).Scan(&d.ID, &d.Slug, &d.Name, &d.Description, &d.PreviewURL, &d.Price, &d.IsFree, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &d, nil
}
