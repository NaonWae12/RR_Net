package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/inventory"
)

var (
	ErrAssetNotFound    = errors.New("asset not found")
	ErrInstanceNotFound = errors.New("asset instance not found")
)

type InventoryRepository struct {
	db *pgxpool.Pool
}

func NewInventoryRepository(db *pgxpool.Pool) *InventoryRepository {
	return &InventoryRepository{db: db}
}

// --- Asset Methods ---

func (r *InventoryRepository) CreateAsset(ctx context.Context, a *inventory.Asset) error {
	query := `
		INSERT INTO assets (id, tenant_id, name, code, category, description, min_stock, unit, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
	`
	_, err := r.db.Exec(ctx, query, a.ID, a.TenantID, a.Name, a.Code, a.Category, a.Description, a.MinStock, a.Unit)
	return err
}

func (r *InventoryRepository) GetAssetByID(ctx context.Context, tenantID, id uuid.UUID) (*inventory.Asset, error) {
	query := `
		SELECT id, tenant_id, name, code, category, description, min_stock, unit, created_at, updated_at, deleted_at
		FROM assets
		WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
	`
	var a inventory.Asset
	err := r.db.QueryRow(ctx, query, id, tenantID).Scan(
		&a.ID, &a.TenantID, &a.Name, &a.Code, &a.Category, &a.Description, &a.MinStock, &a.Unit, &a.CreatedAt, &a.UpdatedAt, &a.DeletedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAssetNotFound
		}
		return nil, err
	}

	// Fetch stock summary
	summary, _ := r.GetAssetStockSummary(ctx, tenantID, id)
	a.StockCounts = summary

	return &a, nil
}

func (r *InventoryRepository) DeleteAsset(ctx context.Context, tenantID, id uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, _ = tx.Exec(ctx, "UPDATE asset_instances SET deleted_at = NOW(), updated_at = NOW() WHERE asset_id = $1 AND tenant_id = $2 AND deleted_at IS NULL", id, tenantID)
	_, err = tx.Exec(ctx, "UPDATE assets SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL", id, tenantID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *InventoryRepository) ListAssets(ctx context.Context, tenantID uuid.UUID, filter *inventory.AssetFilter) ([]*inventory.Asset, int, error) {
	baseQuery := `FROM assets WHERE tenant_id = $1 AND deleted_at IS NULL`
	args := []interface{}{tenantID}
	argNum := 2

	if filter.Category != "" {
		baseQuery += fmt.Sprintf(` AND category = $%d`, argNum)
		args = append(args, filter.Category)
		argNum++
	}

	if filter.Search != "" {
		baseQuery += fmt.Sprintf(` AND (name ILIKE $%d OR code ILIKE $%d)`, argNum, argNum)
		args = append(args, "%"+filter.Search+"%")
		argNum++
	}

	var total int
	err := r.db.QueryRow(ctx, "SELECT COUNT(*) "+baseQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	selectQuery := `SELECT id, tenant_id, name, code, category, description, min_stock, unit, created_at, updated_at ` +
		baseQuery + fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, argNum, argNum+1)
	args = append(args, pageSize, offset)

	rows, err := r.db.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var assets []*inventory.Asset
	for rows.Next() {
		var a inventory.Asset
		err := rows.Scan(&a.ID, &a.TenantID, &a.Name, &a.Code, &a.Category, &a.Description, &a.MinStock, &a.Unit, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, 0, err
		}

		// Add summary for each
		summary, _ := r.GetAssetStockSummary(ctx, tenantID, a.ID)
		a.StockCounts = summary

		assets = append(assets, &a)
	}

	return assets, total, nil
}

func (r *InventoryRepository) GetAssetStockSummary(ctx context.Context, tenantID, assetID uuid.UUID) (*inventory.StockSummary, error) {
	query := `
		SELECT 
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE status = 'in_stock') as in_stock,
			COUNT(*) FILTER (WHERE status = 'deployed') as deployed,
			COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance
		FROM asset_instances
		WHERE asset_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
	`
	var s inventory.StockSummary
	err := r.db.QueryRow(ctx, query, assetID, tenantID).Scan(&s.Total, &s.InStock, &s.Deployed, &s.Maintenance)
	if err != nil {
		return nil, err
	}

	// Check min stock alert from asset table
	var minStock int
	_ = r.db.QueryRow(ctx, "SELECT min_stock FROM assets WHERE id = $1", assetID).Scan(&minStock)
	s.LowStock = s.InStock <= minStock

	return &s, nil
}

func (r *InventoryRepository) GetGlobalSummary(ctx context.Context, tenantID uuid.UUID) (*inventory.GlobalSummary, error) {
	var s inventory.GlobalSummary

	// 1. Total Assets
	err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM assets WHERE tenant_id = $1 AND deleted_at IS NULL", tenantID).Scan(&s.TotalAssets)
	if err != nil {
		return nil, err
	}

	// 2. Active Items (Deployed)
	err = r.db.QueryRow(ctx, "SELECT COUNT(*) FROM asset_instances WHERE tenant_id = $1 AND deleted_at IS NULL AND status = 'deployed'", tenantID).Scan(&s.ActiveItems)
	if err != nil {
		return nil, err
	}

	// 3. Low Stock Assets (Assets where in_stock <= min_stock)
	lowStockQuery := `
		SELECT COUNT(*) FROM (
			SELECT a.id
			FROM assets a
			LEFT JOIN asset_instances i ON a.id = i.asset_id AND i.deleted_at IS NULL AND i.status = 'in_stock'
			WHERE a.tenant_id = $1 AND a.deleted_at IS NULL
			GROUP BY a.id, a.min_stock
			HAVING COUNT(i.id) <= a.min_stock
		) low_assets
	`
	err = r.db.QueryRow(ctx, lowStockQuery, tenantID).Scan(&s.LowStockAssets)
	if err != nil {
		return nil, err
	}

	return &s, nil
}

// --- Instance Methods ---

func (r *InventoryRepository) CreateInstance(ctx context.Context, inst *inventory.AssetInstance) error {
	query := `
		INSERT INTO asset_instances (id, asset_id, tenant_id, serial_number, status, condition, location, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
	`
	_, err := r.db.Exec(ctx, query, inst.ID, inst.AssetID, inst.TenantID, inst.SerialNumber, inst.Status, inst.Condition, inst.Location)
	return err
}

func (r *InventoryRepository) ListInstances(ctx context.Context, tenantID uuid.UUID, assetID uuid.UUID) ([]*inventory.AssetInstance, error) {
	query := `
		SELECT id, asset_id, tenant_id, serial_number, status, condition, location, last_checked_at, last_checked_by, created_at, updated_at
		FROM asset_instances
		WHERE asset_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(ctx, query, assetID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var instances []*inventory.AssetInstance
	for rows.Next() {
		var i inventory.AssetInstance
		err := rows.Scan(&i.ID, &i.AssetID, &i.TenantID, &i.SerialNumber, &i.Status, &i.Condition, &i.Location, &i.LastCheckedAt, &i.LastCheckedBy, &i.CreatedAt, &i.UpdatedAt)
		if err != nil {
			return nil, err
		}
		instances = append(instances, &i)
	}
	return instances, nil
}

func (r *InventoryRepository) GetInstanceByID(ctx context.Context, id uuid.UUID) (*inventory.AssetInstance, error) {
	query := `
		SELECT 
			i.id, i.asset_id, i.tenant_id, i.serial_number, i.status, i.condition, i.location, 
			i.last_checked_at, i.last_checked_by, i.created_at, i.updated_at,
			a.id, a.name, a.code, a.category, a.description, a.unit
		FROM asset_instances i
		JOIN assets a ON i.asset_id = a.id
		WHERE i.id = $1 AND i.deleted_at IS NULL AND a.deleted_at IS NULL
	`
	var i inventory.AssetInstance
	var a inventory.Asset
	err := r.db.QueryRow(ctx, query, id).Scan(
		&i.ID, &i.AssetID, &i.TenantID, &i.SerialNumber, &i.Status, &i.Condition, &i.Location, 
		&i.LastCheckedAt, &i.LastCheckedBy, &i.CreatedAt, &i.UpdatedAt,
		&a.ID, &a.Name, &a.Code, &a.Category, &a.Description, &a.Unit,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInstanceNotFound
		}
		return nil, err
	}
	i.Asset = &a
	return &i, nil
}

func (r *InventoryRepository) CountInstances(ctx context.Context, tenantID uuid.UUID, assetID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM asset_instances WHERE asset_id = $1 AND tenant_id = $2 AND deleted_at IS NULL", assetID, tenantID).Scan(&count)
	return count, err
}

func (r *InventoryRepository) UpdateInstance(ctx context.Context, inst *inventory.AssetInstance) error {
	query := `
		UPDATE asset_instances
		SET status = $3, condition = $4, location = $5, last_checked_at = NOW(), last_checked_by = $6, updated_at = NOW()
		WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
	`
	_, err := r.db.Exec(ctx, query, inst.ID, inst.TenantID, inst.Status, inst.Condition, inst.Location, inst.LastCheckedBy)
	return err
}

// --- Log Methods ---

func (r *InventoryRepository) CreateLog(ctx context.Context, l *inventory.AssetLog) error {
	query := `
		INSERT INTO asset_logs (id, tenant_id, asset_id, instance_id, action, from_value, to_value, actor, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
	`
	_, err := r.db.Exec(ctx, query, uuid.New(), l.TenantID, l.AssetID, l.InstanceID, l.Action, l.FromValue, l.ToValue, l.Actor, l.Notes)
	return err
}

func (r *InventoryRepository) ListLogs(ctx context.Context, tenantID uuid.UUID, assetID *uuid.UUID, instanceID *uuid.UUID) ([]*inventory.AssetLog, error) {
	query := `SELECT id, tenant_id, asset_id, instance_id, action, from_value, to_value, actor, notes, created_at FROM asset_logs WHERE tenant_id = $1`
	args := []interface{}{tenantID}

	if assetID != nil {
		query += " AND asset_id = $2"
		args = append(args, *assetID)
	} else if instanceID != nil {
		query += " AND instance_id = $2"
		args = append(args, *instanceID)
	}

	query += " ORDER BY created_at DESC LIMIT 50"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*inventory.AssetLog
	for rows.Next() {
		var l inventory.AssetLog
		err := rows.Scan(&l.ID, &l.TenantID, &l.AssetID, &l.InstanceID, &l.Action, &l.FromValue, &l.ToValue, &l.Actor, &l.Notes, &l.CreatedAt)
		if err != nil {
			return nil, err
		}
		logs = append(logs, &l)
	}
	return logs, nil
}
