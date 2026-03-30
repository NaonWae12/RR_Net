package service

import (
	"context"
	"fmt"

	"rrnet/internal/domain/inventory"
	"rrnet/internal/repository"

	"github.com/google/uuid"
)

type InventoryService struct {
	repo *repository.InventoryRepository
}

func NewInventoryService(repo *repository.InventoryRepository) *InventoryService {
	return &InventoryService{repo: repo}
}

// --- Asset Logic ---

func (s *InventoryService) CreateAsset(ctx context.Context, tenantID uuid.UUID, a *inventory.Asset, initialStock int, condition inventory.InstanceCondition, actor string) error {
	a.ID = uuid.New()
	a.TenantID = tenantID

	if err := s.repo.CreateAsset(ctx, a); err != nil {
		return err
	}

	// Create initial instances if stock > 0
	for i := 0; i < initialStock; i++ {
		inst := &inventory.AssetInstance{
			AssetID:      a.ID,
			SerialNumber: fmt.Sprintf("%s-%03d", a.Code, i+1),
			Status:       inventory.StatusInStock,
			Condition:    condition,
			Location:     "Warehouse / Central",
		}
		_ = s.AddInstance(ctx, tenantID, inst, actor)
	}

	return nil
}

func (s *InventoryService) GetAsset(ctx context.Context, tenantID, assetID uuid.UUID) (*inventory.Asset, error) {
	return s.repo.GetAssetByID(ctx, tenantID, assetID)
}

func (s *InventoryService) ListAssets(ctx context.Context, tenantID uuid.UUID, filter *inventory.AssetFilter) ([]*inventory.Asset, int, error) {
	return s.repo.ListAssets(ctx, tenantID, filter)
}

func (s *InventoryService) GetGlobalSummary(ctx context.Context, tenantID uuid.UUID) (*inventory.GlobalSummary, error) {
	return s.repo.GetGlobalSummary(ctx, tenantID)
}

func (s *InventoryService) DeleteAsset(ctx context.Context, tenantID, assetID uuid.UUID, actor string) error {
	err := s.repo.DeleteAsset(ctx, tenantID, assetID)
	if err == nil {
		_ = s.repo.CreateLog(ctx, &inventory.AssetLog{
			TenantID: tenantID,
			AssetID:  &assetID,
			Action:   "asset_deleted",
			Actor:    actor,
			Notes:    fmt.Sprintf("Asset and all units soft-deleted by %s", actor),
		})
	}
	return err
}

// --- Instance Logic ---

func (s *InventoryService) AddInstance(ctx context.Context, tenantID uuid.UUID, inst *inventory.AssetInstance, actor string) error {
	inst.ID = uuid.New()
	inst.TenantID = tenantID

	// Generate serial number if empty
	if inst.SerialNumber == "" {
		asset, err := s.repo.GetAssetByID(ctx, tenantID, inst.AssetID)
		if err == nil {
			count, _ := s.repo.CountInstances(ctx, tenantID, inst.AssetID)
			inst.SerialNumber = fmt.Sprintf("%s-%03d", asset.Code, count+1)
		}
	}

	err := s.repo.CreateInstance(ctx, inst)
	if err != nil {
		return err
	}

	// Log the addition
	return s.repo.CreateLog(ctx, &inventory.AssetLog{
		TenantID:   tenantID,
		AssetID:    &inst.AssetID,
		InstanceID: &inst.ID,
		Action:     "CHECK_IN",
		ToValue:    string(inst.Status),
		Actor:      actor,
		Notes:      fmt.Sprintf("Initial check-in at %s", inst.Location),
	})
}

func (s *InventoryService) ListInstances(ctx context.Context, tenantID uuid.UUID, assetID uuid.UUID) ([]*inventory.AssetInstance, error) {
	return s.repo.ListInstances(ctx, tenantID, assetID)
}

func (s *InventoryService) GetInstanceDetail(ctx context.Context, id uuid.UUID) (*inventory.AssetInstance, error) {
	return s.repo.GetInstanceByID(ctx, id)
}

func (s *InventoryService) UpdateInstance(ctx context.Context, tenantID uuid.UUID, assetID uuid.UUID, id uuid.UUID, req *inventory.AssetInstance, actor string) error {
	// Get current state for logging
	current, err := s.repo.ListInstances(ctx, tenantID, assetID)
	if err != nil {
		return err
	}

	var target *inventory.AssetInstance
	for _, i := range current {
		if i.ID == id {
			target = i
			break
		}
	}

	if target == nil {
		return repository.ErrInstanceNotFound
	}

	// Update record
	target.Status = req.Status
	target.Condition = req.Condition
	target.Location = req.Location
	target.LastCheckedBy = &actor

	err = s.repo.UpdateInstance(ctx, target)
	if err != nil {
		return err
	}

	// Log change
	return s.repo.CreateLog(ctx, &inventory.AssetLog{
		TenantID:   tenantID,
		AssetID:    &assetID,
		InstanceID: &id,
		Action:     "STATUS_UPDATE",
		FromValue:  string(target.Status), // Simplified for log
		ToValue:    string(req.Status),
		Actor:      actor,
		Notes:      fmt.Sprintf("Condition: %s, Location: %s", req.Condition, req.Location),
	})
}

// --- Bulk Logic ---

func (s *InventoryService) BulkStatusUpdate(ctx context.Context, tenantID uuid.UUID, assetID uuid.UUID, status inventory.InstanceStatus, actor string) error {
	instances, err := s.repo.ListInstances(ctx, tenantID, assetID)
	if err != nil {
		return err
	}

	for _, inst := range instances {
		if inst.Status == status {
			continue
		}

		oldStatus := inst.Status
		inst.Status = status
		inst.LastCheckedBy = &actor

		_ = s.repo.UpdateInstance(ctx, inst)

		// Log each
		_ = s.repo.CreateLog(ctx, &inventory.AssetLog{
			TenantID:   tenantID,
			AssetID:    &assetID,
			InstanceID: &inst.ID,
			Action:     "BULK_STATUS_CHANGE",
			FromValue:  string(oldStatus),
			ToValue:    string(status),
			Actor:      actor,
			Notes:      "Applied via global settings",
		})
	}

	return nil
}

// --- Audit Logic ---

func (s *InventoryService) GetHistory(ctx context.Context, tenantID uuid.UUID, assetID *uuid.UUID, instanceID *uuid.UUID) ([]*inventory.AssetLog, error) {
	return s.repo.ListLogs(ctx, tenantID, assetID, instanceID)
}
