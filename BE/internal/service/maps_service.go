package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/maps"
	"rrnet/internal/repository"
)

type MapsService struct {
	odcRepo          *repository.ODCRepository
	odpRepo          *repository.ODPRepository
	clientLocRepo    *repository.ClientLocationRepository
	outageRepo       *repository.OutageRepository
	topologyRepo     *repository.TopologyRepository
}

func NewMapsService(
	odcRepo *repository.ODCRepository,
	odpRepo *repository.ODPRepository,
	clientLocRepo *repository.ClientLocationRepository,
	outageRepo *repository.OutageRepository,
	topologyRepo *repository.TopologyRepository,
) *MapsService {
	return &MapsService{
		odcRepo:       odcRepo,
		odpRepo:       odpRepo,
		clientLocRepo: clientLocRepo,
		outageRepo:    outageRepo,
		topologyRepo:  topologyRepo,
	}
}

// ========== ODC Operations ==========

type CreateODCRequest struct {
	Name        string  `json:"name"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	CapacityInfo string `json:"capacity_info,omitempty"`
	Notes       string  `json:"notes,omitempty"`
}

func (s *MapsService) CreateODC(ctx context.Context, tenantID uuid.UUID, req CreateODCRequest) (*maps.ODC, error) {
	now := time.Now()
	odc := &maps.ODC{
		ID:          uuid.New(),
		TenantID:    tenantID,
		Name:        req.Name,
		Latitude:    req.Latitude,
		Longitude:   req.Longitude,
		CapacityInfo: req.CapacityInfo,
		Notes:       req.Notes,
		Status:      maps.NodeStatusOK,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.odcRepo.Create(ctx, odc); err != nil {
		return nil, fmt.Errorf("failed to create ODC: %w", err)
	}

	return odc, nil
}

func (s *MapsService) GetODC(ctx context.Context, id uuid.UUID) (*maps.ODC, error) {
	return s.odcRepo.GetByID(ctx, id)
}

func (s *MapsService) ListODCs(ctx context.Context, tenantID uuid.UUID) ([]*maps.ODC, error) {
	return s.odcRepo.ListByTenant(ctx, tenantID)
}

type UpdateODCRequest struct {
	Name        *string  `json:"name,omitempty"`
	Latitude    *float64 `json:"latitude,omitempty"`
	Longitude   *float64 `json:"longitude,omitempty"`
	CapacityInfo *string `json:"capacity_info,omitempty"`
	Notes       *string  `json:"notes,omitempty"`
}

func (s *MapsService) UpdateODC(ctx context.Context, id uuid.UUID, req UpdateODCRequest) (*maps.ODC, error) {
	odc, err := s.odcRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		odc.Name = *req.Name
	}
	if req.Latitude != nil {
		odc.Latitude = *req.Latitude
	}
	if req.Longitude != nil {
		odc.Longitude = *req.Longitude
	}
	if req.CapacityInfo != nil {
		odc.CapacityInfo = *req.CapacityInfo
	}
	if req.Notes != nil {
		odc.Notes = *req.Notes
	}
	odc.UpdatedAt = time.Now()

	if err := s.odcRepo.Update(ctx, odc); err != nil {
		return nil, fmt.Errorf("failed to update ODC: %w", err)
	}

	return odc, nil
}

func (s *MapsService) DeleteODC(ctx context.Context, id uuid.UUID) error {
	return s.odcRepo.Delete(ctx, id)
}

// ========== ODP Operations ==========

type CreateODPRequest struct {
	ODCID     uuid.UUID `json:"odc_id"`
	Name      string    `json:"name"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	PortCount int       `json:"port_count"`
	Notes     string    `json:"notes,omitempty"`
}

func (s *MapsService) CreateODP(ctx context.Context, tenantID uuid.UUID, req CreateODPRequest) (*maps.ODP, error) {
	now := time.Now()
	odp := &maps.ODP{
		ID:        uuid.New(),
		TenantID:  tenantID,
		ODCID:     req.ODCID,
		Name:      req.Name,
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		PortCount: req.PortCount,
		UsedPorts: 0,
		Notes:     req.Notes,
		Status:    maps.NodeStatusOK,
		CreatedAt: now,
		UpdatedAt: now,
	}
	odp.UpdateStatus()

	if err := s.odpRepo.Create(ctx, odp); err != nil {
		return nil, fmt.Errorf("failed to create ODP: %w", err)
	}

	// Create topology link
	link := &maps.TopologyLink{
		ID:        uuid.New(),
		TenantID:  tenantID,
		FromType:  maps.NodeTypeODC,
		FromID:    req.ODCID,
		ToType:    maps.NodeTypeODP,
		ToID:      odp.ID,
		CreatedAt: now,
	}
	if err := s.topologyRepo.CreateLink(ctx, link); err != nil {
		return nil, fmt.Errorf("failed to create topology link: %w", err)
	}

	return odp, nil
}

func (s *MapsService) GetODP(ctx context.Context, id uuid.UUID) (*maps.ODP, error) {
	return s.odpRepo.GetByID(ctx, id)
}

func (s *MapsService) ListODPs(ctx context.Context, tenantID uuid.UUID) ([]*maps.ODP, error) {
	return s.odpRepo.ListByTenant(ctx, tenantID)
}

func (s *MapsService) ListODPsByODC(ctx context.Context, odcID uuid.UUID) ([]*maps.ODP, error) {
	return s.odpRepo.ListByODC(ctx, odcID)
}

type UpdateODPRequest struct {
	Name      *string    `json:"name,omitempty"`
	Latitude  *float64   `json:"latitude,omitempty"`
	Longitude *float64   `json:"longitude,omitempty"`
	PortCount *int       `json:"port_count,omitempty"`
	Notes     *string    `json:"notes,omitempty"`
}

func (s *MapsService) UpdateODP(ctx context.Context, id uuid.UUID, req UpdateODPRequest) (*maps.ODP, error) {
	odp, err := s.odpRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.Name != nil {
		odp.Name = *req.Name
	}
	if req.Latitude != nil {
		odp.Latitude = *req.Latitude
	}
	if req.Longitude != nil {
		odp.Longitude = *req.Longitude
	}
	if req.PortCount != nil {
		odp.PortCount = *req.PortCount
	}
	if req.Notes != nil {
		odp.Notes = *req.Notes
	}
	odp.UpdateStatus()
	odp.UpdatedAt = time.Now()

	if err := s.odpRepo.Update(ctx, odp); err != nil {
		return nil, fmt.Errorf("failed to update ODP: %w", err)
	}

	return odp, nil
}

func (s *MapsService) DeleteODP(ctx context.Context, id uuid.UUID) error {
	return s.odpRepo.Delete(ctx, id)
}

// ========== Client Location Operations ==========

type CreateClientLocationRequest struct {
	ClientID       uuid.UUID            `json:"client_id"`
	ODPID          uuid.UUID            `json:"odp_id"`
	Latitude       float64              `json:"latitude"`
	Longitude      float64              `json:"longitude"`
	ConnectionType maps.ConnectionType  `json:"connection_type"`
	SignalInfo     string               `json:"signal_info,omitempty"`
	Notes          string                `json:"notes,omitempty"`
}

func (s *MapsService) CreateClientLocation(ctx context.Context, tenantID uuid.UUID, req CreateClientLocationRequest) (*maps.ClientLocation, error) {
	now := time.Now()
	loc := &maps.ClientLocation{
		ID:             uuid.New(),
		TenantID:       tenantID,
		ClientID:       req.ClientID,
		ODPID:          req.ODPID,
		Latitude:       req.Latitude,
		Longitude:      req.Longitude,
		ConnectionType: req.ConnectionType,
		SignalInfo:     req.SignalInfo,
		Notes:          req.Notes,
		Status:         maps.NodeStatusOK,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if err := s.clientLocRepo.Create(ctx, loc); err != nil {
		return nil, fmt.Errorf("failed to create client location: %w", err)
	}

	// Increment ODP used ports
	if err := s.odpRepo.IncrementUsedPorts(ctx, req.ODPID); err != nil {
		return nil, fmt.Errorf("failed to increment ODP ports: %w", err)
	}

	// Create topology link
	link := &maps.TopologyLink{
		ID:        uuid.New(),
		TenantID:  tenantID,
		FromType:  maps.NodeTypeODP,
		FromID:    req.ODPID,
		ToType:    maps.NodeTypeClient,
		ToID:      loc.ID,
		CreatedAt: now,
	}
	if err := s.topologyRepo.CreateLink(ctx, link); err != nil {
		return nil, fmt.Errorf("failed to create topology link: %w", err)
	}

	return loc, nil
}

func (s *MapsService) GetClientLocation(ctx context.Context, id uuid.UUID) (*maps.ClientLocation, error) {
	return s.clientLocRepo.GetByID(ctx, id)
}

func (s *MapsService) GetClientLocationByClientID(ctx context.Context, clientID uuid.UUID) (*maps.ClientLocation, error) {
	return s.clientLocRepo.GetByClientID(ctx, clientID)
}

func (s *MapsService) ListClientLocations(ctx context.Context, tenantID uuid.UUID) ([]*maps.ClientLocation, error) {
	return s.clientLocRepo.ListByTenant(ctx, tenantID)
}

func (s *MapsService) ListClientLocationsByODP(ctx context.Context, odpID uuid.UUID) ([]*maps.ClientLocation, error) {
	return s.clientLocRepo.ListByODP(ctx, odpID)
}

func (s *MapsService) FindNearestODP(ctx context.Context, tenantID uuid.UUID, lat, lng float64) ([]uuid.UUID, error) {
	return s.clientLocRepo.FindNearestODP(ctx, tenantID, lat, lng, 5)
}

type UpdateClientLocationRequest struct {
	ODPID          *uuid.UUID           `json:"odp_id,omitempty"`
	Latitude       *float64             `json:"latitude,omitempty"`
	Longitude      *float64             `json:"longitude,omitempty"`
	ConnectionType *maps.ConnectionType `json:"connection_type,omitempty"`
	SignalInfo     *string              `json:"signal_info,omitempty"`
	Notes          *string               `json:"notes,omitempty"`
}

func (s *MapsService) UpdateClientLocation(ctx context.Context, id uuid.UUID, req UpdateClientLocationRequest) (*maps.ClientLocation, error) {
	loc, err := s.clientLocRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	oldODPID := loc.ODPID

	if req.ODPID != nil {
		loc.ODPID = *req.ODPID
	}
	if req.Latitude != nil {
		loc.Latitude = *req.Latitude
	}
	if req.Longitude != nil {
		loc.Longitude = *req.Longitude
	}
	if req.ConnectionType != nil {
		loc.ConnectionType = *req.ConnectionType
	}
	if req.SignalInfo != nil {
		loc.SignalInfo = *req.SignalInfo
	}
	if req.Notes != nil {
		loc.Notes = *req.Notes
	}
	loc.UpdatedAt = time.Now()

	if err := s.clientLocRepo.Update(ctx, loc); err != nil {
		return nil, fmt.Errorf("failed to update client location: %w", err)
	}

	// Update ODP port counts if ODP changed
	if req.ODPID != nil && *req.ODPID != oldODPID {
		if err := s.odpRepo.DecrementUsedPorts(ctx, oldODPID); err != nil {
			return nil, fmt.Errorf("failed to decrement old ODP ports: %w", err)
		}
		if err := s.odpRepo.IncrementUsedPorts(ctx, *req.ODPID); err != nil {
			return nil, fmt.Errorf("failed to increment new ODP ports: %w", err)
		}
	}

	return loc, nil
}

func (s *MapsService) DeleteClientLocation(ctx context.Context, id uuid.UUID) error {
	loc, err := s.clientLocRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if err := s.clientLocRepo.Delete(ctx, id); err != nil {
		return err
	}

	// Decrement ODP used ports
	return s.odpRepo.DecrementUsedPorts(ctx, loc.ODPID)
}

// ========== Outage Operations ==========

type ReportOutageRequest struct {
	NodeType maps.NodeType `json:"node_type"`
	NodeID   uuid.UUID     `json:"node_id"`
	Reason   string        `json:"reason"`
}

func (s *MapsService) ReportOutage(ctx context.Context, tenantID, userID uuid.UUID, req ReportOutageRequest) (*maps.OutageEvent, error) {
	now := time.Now()
	outage := &maps.OutageEvent{
		ID:          uuid.New(),
		TenantID:    tenantID,
		NodeType:    req.NodeType,
		NodeID:      req.NodeID,
		Reason:      req.Reason,
		ReportedBy:  userID,
		ReportedAt:  now,
		IsResolved:  false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	// Update node status
	var affectedNodes []uuid.UUID
	switch req.NodeType {
	case maps.NodeTypeODC:
		if err := s.odcRepo.UpdateStatus(ctx, req.NodeID, maps.NodeStatusOutage); err != nil {
			return nil, err
		}
		// Cascade to ODPs and Clients
		affectedNodes = s.propagateODCOutage(ctx, req.NodeID)
	case maps.NodeTypeODP:
		if err := s.odpRepo.UpdateStatus(ctx, req.NodeID, maps.NodeStatusOutage); err != nil {
			return nil, err
		}
		// Cascade to Clients
		affectedNodes = s.propagateODPOutage(ctx, req.NodeID)
	case maps.NodeTypeClient:
		if err := s.clientLocRepo.UpdateStatus(ctx, req.NodeID, maps.NodeStatusOutage); err != nil {
			return nil, err
		}
		// Client outage does not propagate
	}

	outage.AffectedNodes = affectedNodes

	if err := s.outageRepo.Create(ctx, outage); err != nil {
		return nil, fmt.Errorf("failed to create outage event: %w", err)
	}

	return outage, nil
}

func (s *MapsService) propagateODCOutage(ctx context.Context, odcID uuid.UUID) []uuid.UUID {
	var affected []uuid.UUID

	// Get all ODPs under this ODC
	odpIDs, err := s.topologyRepo.GetODPsByODC(ctx, odcID)
	if err != nil {
		return affected
	}

	for _, odpID := range odpIDs {
		// Mark ODP as outage
		_ = s.odpRepo.UpdateStatus(ctx, odpID, maps.NodeStatusOutage)
		affected = append(affected, odpID)

		// Get all clients under this ODP
		clientIDs, err := s.topologyRepo.GetClientsByODP(ctx, odpID)
		if err != nil {
			continue
		}

		for _, clientID := range clientIDs {
			// Mark client as outage
			_ = s.clientLocRepo.UpdateStatus(ctx, clientID, maps.NodeStatusOutage)
			affected = append(affected, clientID)
		}
	}

	return affected
}

func (s *MapsService) propagateODPOutage(ctx context.Context, odpID uuid.UUID) []uuid.UUID {
	var affected []uuid.UUID

	// Get all clients under this ODP
	clientIDs, err := s.topologyRepo.GetClientsByODP(ctx, odpID)
	if err != nil {
		return affected
	}

	for _, clientID := range clientIDs {
		// Mark client as outage
		_ = s.clientLocRepo.UpdateStatus(ctx, clientID, maps.NodeStatusOutage)
		affected = append(affected, clientID)
	}

	return affected
}

type ResolveOutageRequest struct {
	OutageID uuid.UUID `json:"outage_id"`
}

func (s *MapsService) ResolveOutage(ctx context.Context, tenantID, userID uuid.UUID, req ResolveOutageRequest) error {
	outage, err := s.outageRepo.GetByID(ctx, req.OutageID)
	if err != nil {
		return err
	}

	if outage.TenantID != tenantID {
		return fmt.Errorf("outage event not found")
	}

	// Resolve the outage event
	if err := s.outageRepo.Resolve(ctx, req.OutageID, userID); err != nil {
		return err
	}

	// Restore node status
	switch outage.NodeType {
	case maps.NodeTypeODC:
		_ = s.odcRepo.UpdateStatus(ctx, outage.NodeID, maps.NodeStatusOK)
		// Restore affected nodes
		s.restoreODCOutage(ctx, outage.NodeID)
	case maps.NodeTypeODP:
		_ = s.odpRepo.UpdateStatus(ctx, outage.NodeID, maps.NodeStatusOK)
		// Restore affected nodes
		s.restoreODPOutage(ctx, outage.NodeID)
	case maps.NodeTypeClient:
		_ = s.clientLocRepo.UpdateStatus(ctx, outage.NodeID, maps.NodeStatusOK)
	}

	return nil
}

func (s *MapsService) restoreODCOutage(ctx context.Context, odcID uuid.UUID) {
	odpIDs, _ := s.topologyRepo.GetODPsByODC(ctx, odcID)
	for _, odpID := range odpIDs {
		odp, _ := s.odpRepo.GetByID(ctx, odpID)
		if odp != nil {
			odp.UpdateStatus()
			_ = s.odpRepo.Update(ctx, odp)
		}
		s.restoreODPOutage(ctx, odpID)
	}
}

func (s *MapsService) restoreODPOutage(ctx context.Context, odpID uuid.UUID) {
	clientIDs, _ := s.topologyRepo.GetClientsByODP(ctx, odpID)
	for _, clientID := range clientIDs {
		_ = s.clientLocRepo.UpdateStatus(ctx, clientID, maps.NodeStatusOK)
	}
}

func (s *MapsService) ListOutages(ctx context.Context, tenantID uuid.UUID, includeResolved bool) ([]*maps.OutageEvent, error) {
	return s.outageRepo.ListByTenant(ctx, tenantID, includeResolved)
}

func (s *MapsService) GetOutage(ctx context.Context, id uuid.UUID) (*maps.OutageEvent, error) {
	return s.outageRepo.GetByID(ctx, id)
}

// ========== Topology Operations ==========

func (s *MapsService) GetTopology(ctx context.Context, tenantID uuid.UUID) ([]*maps.TopologyLink, error) {
	return s.topologyRepo.ListByTenant(ctx, tenantID)
}

