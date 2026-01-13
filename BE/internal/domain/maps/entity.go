package maps

import (
	"time"

	"github.com/google/uuid"
)

// NodeType defines the type of network node
type NodeType string

const (
	NodeTypeODC    NodeType = "odc"
	NodeTypeODP    NodeType = "odp"
	NodeTypeClient NodeType = "client"
)

// NodeStatus defines the status of a node
type NodeStatus string

const (
	NodeStatusOK      NodeStatus = "ok"
	NodeStatusWarning NodeStatus = "warning" // Near capacity
	NodeStatusFull    NodeStatus = "full"
	NodeStatusOutage  NodeStatus = "outage"
)

// ConnectionType defines client connection type
type ConnectionType string

const (
	ConnectionTypePPPoE  ConnectionType = "pppoe"
	ConnectionTypeHotspot ConnectionType = "hotspot"
	ConnectionTypeStatic  ConnectionType = "static"
)

// ODC represents an Optical Distribution Cabinet
type ODC struct {
	ID          uuid.UUID  `json:"id"`
	TenantID    uuid.UUID  `json:"tenant_id"`
	Name        string     `json:"name"`
	Latitude    float64    `json:"latitude"`
	Longitude   float64    `json:"longitude"`
	CapacityInfo string    `json:"capacity_info,omitempty"`
	Notes       string     `json:"notes,omitempty"`
	Status      NodeStatus `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// ODP represents an Optical Distribution Point
type ODP struct {
	ID        uuid.UUID  `json:"id"`
	TenantID  uuid.UUID  `json:"tenant_id"`
	ODCID     uuid.UUID  `json:"odc_id"`
	Name      string     `json:"name"`
	Latitude  float64    `json:"latitude"`
	Longitude float64    `json:"longitude"`
	PortCount int        `json:"port_count"`
	UsedPorts int        `json:"used_ports"`
	Notes     string     `json:"notes,omitempty"`
	Status    NodeStatus `json:"status"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// ClientLocation represents a client's physical location on the map
type ClientLocation struct {
	ID             uuid.UUID     `json:"id"`
	TenantID       uuid.UUID     `json:"tenant_id"`
	ClientID       uuid.UUID     `json:"client_id"`
	ODPID          uuid.UUID     `json:"odp_id"`
	Latitude       float64       `json:"latitude"`
	Longitude      float64       `json:"longitude"`
	ConnectionType ConnectionType `json:"connection_type"`
	SignalInfo     string         `json:"signal_info,omitempty"`
	Notes          string         `json:"notes,omitempty"`
	Status         NodeStatus     `json:"status"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// OutageEvent represents an outage event for any node
type OutageEvent struct {
	ID          uuid.UUID  `json:"id"`
	TenantID    uuid.UUID  `json:"tenant_id"`
	NodeType    NodeType   `json:"node_type"`
	NodeID      uuid.UUID  `json:"node_id"`
	Reason      string     `json:"reason"`
	ReportedBy  uuid.UUID  `json:"reported_by"`
	ReportedAt  time.Time  `json:"reported_at"`
	ResolvedAt  *time.Time `json:"resolved_at,omitempty"`
	ResolvedBy  *uuid.UUID `json:"resolved_by,omitempty"`
	IsResolved  bool       `json:"is_resolved"`
	AffectedNodes []uuid.UUID `json:"affected_nodes,omitempty"` // Nodes affected by cascade
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// TopologyLink represents a connection between nodes
type TopologyLink struct {
	ID         uuid.UUID `json:"id"`
	TenantID   uuid.UUID `json:"tenant_id"`
	FromType   NodeType  `json:"from_type"`
	FromID     uuid.UUID `json:"from_id"`
	ToType     NodeType  `json:"to_type"`
	ToID       uuid.UUID `json:"to_id"`
	CreatedAt  time.Time `json:"created_at"`
}

// GetCapacityPercentage returns the capacity percentage for ODP
func (o *ODP) GetCapacityPercentage() float64 {
	if o.PortCount == 0 {
		return 0
	}
	return float64(o.UsedPorts) / float64(o.PortCount) * 100
}

// IsNearCapacity checks if ODP is near capacity (>= 80%)
func (o *ODP) IsNearCapacity() bool {
	return o.GetCapacityPercentage() >= 80
}

// UpdateStatus updates ODP status based on capacity
func (o *ODP) UpdateStatus() {
	if o.UsedPorts >= o.PortCount {
		o.Status = NodeStatusFull
	} else if o.IsNearCapacity() {
		o.Status = NodeStatusWarning
	} else {
		o.Status = NodeStatusOK
	}
}

