package inventory

import (
	"time"

	"github.com/google/uuid"
)

// InstanceStatus represents the status of an individual asset unit
type InstanceStatus string

const (
	StatusInStock     InstanceStatus = "in_stock"
	StatusDeployed    InstanceStatus = "deployed"
	StatusMaintenance InstanceStatus = "maintenance"
	StatusDisposed    InstanceStatus = "disposed"
	StatusSold        InstanceStatus = "sold"
)

// InstanceCondition represents the physical state of an individual asset unit
type InstanceCondition string

const (
	ConditionNew         InstanceCondition = "new"
	ConditionSecond      InstanceCondition = "second"
	ConditionBroken      InstanceCondition = "broken"
	ConditionRefurbished InstanceCondition = "refurbished"
)

// Asset represents a general classification of inventory items
type Asset struct {
	ID          uuid.UUID  `json:"id"`
	TenantID    uuid.UUID  `json:"tenant_id"`
	Name        string     `json:"name"`
	Code        string     `json:"code"` // SKU / System Code
	Category    string     `json:"category"`
	Description string     `json:"description"`
	MinStock    int        `json:"min_stock"`
	Unit        string     `json:"unit"` // e.g., pcs, meter, roll
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	DeletedAt   *time.Time `json:"deleted_at,omitempty"`

	// Virtual fields for summary
	StockCounts *StockSummary `json:"stock_summary,omitempty"`
}

// StockSummary provides count details for an asset
type StockSummary struct {
	Total       int  `json:"total"`
	InStock     int  `json:"in_stock"`
	Deployed    int  `json:"deployed"`
	Maintenance int  `json:"maintenance"`
	LowStock    bool `json:"low_stock"`
}

// GlobalSummary provides high-level metrics for the dashboard
type GlobalSummary struct {
	TotalAssets    int `json:"total_assets"`
	ActiveItems    int `json:"active_items"`
	LowStockAssets int `json:"low_stock_assets"`
}

// AssetInstance represents a unique, tracked physical unit
type AssetInstance struct {
	ID            uuid.UUID         `json:"id"`
	AssetID       uuid.UUID         `json:"asset_id"`
	TenantID      uuid.UUID         `json:"tenant_id"`
	SerialNumber  string            `json:"serial_number"`
	Status        InstanceStatus    `json:"status"`
	Condition     InstanceCondition `json:"condition"`
	Location      string            `json:"location"`
	LastCheckedAt *time.Time        `json:"last_checked_at,omitempty"`
	LastCheckedBy *string           `json:"last_checked_by,omitempty"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
	DeletedAt     *time.Time        `json:"deleted_at,omitempty"`

	// Relations
	Asset *Asset `json:"asset,omitempty"`
}

// AssetLog represents a historical log of an asset or instance
type AssetLog struct {
	ID         uuid.UUID  `json:"id"`
	TenantID   uuid.UUID  `json:"tenant_id"`
	AssetID    *uuid.UUID `json:"asset_id,omitempty"`
	InstanceID *uuid.UUID `json:"instance_id,omitempty"`
	Action     string     `json:"action"` // STATUS_CHANGE, TRANSFER, DISPOSAL
	FromValue  string     `json:"from_value"`
	ToValue    string     `json:"to_value"`
	Actor      string     `json:"actor"`
	Notes      string     `json:"notes"`
	CreatedAt  time.Time  `json:"created_at"`
}

// AssetFilter for listing assets
type AssetFilter struct {
	Category string `json:"category"`
	Search   string `json:"search"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}

// InstanceFilter for listing units
type InstanceFilter struct {
	AssetID   uuid.UUID         `json:"asset_id"`
	Status    InstanceStatus    `json:"status"`
	Condition InstanceCondition `json:"condition"`
	Search    string            `json:"search"`
}
