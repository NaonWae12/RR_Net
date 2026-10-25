package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/domain/acs"
)

var (
	ErrACSDeviceNotFound             = errors.New("perangkat ONT tidak ditemukan")
	ErrACSDeviceOwnedByAnotherTenant = errors.New("perangkat ONT ini sudah terdaftar di tenant lain")
	ErrACSDeviceUnauthorized         = errors.New("perangkat ONT tidak terdaftar di tenant Anda")
)

type ACSDeviceRepository struct {
	db *pgxpool.Pool
}

func NewACSDeviceRepository(db *pgxpool.Pool) *ACSDeviceRepository {
	return &ACSDeviceRepository{db: db}
}

// ListByTenant returns all registered ACS devices for a given tenant, joining client name if linked.
func (r *ACSDeviceRepository) ListByTenant(ctx context.Context, tenantID uuid.UUID) ([]*acs.DeviceTenant, error) {
	query := `
		SELECT 
			d.id, 
			d.tenant_id, 
			d.device_id, 
			COALESCE(d.serial_number, ''), 
			COALESCE(d.label, ''), 
			d.client_id, 
			COALESCE(c.name, ''), 
			COALESCE(d.wifi_ssid, ''),
			COALESCE(d.wifi_password, ''),
			d.wifi_updated_at,
			d.created_at, 
			d.updated_at
		FROM acs_device_tenants d
		LEFT JOIN clients c ON c.id = d.client_id AND c.deleted_at IS NULL
		WHERE d.tenant_id = $1
		ORDER BY d.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*acs.DeviceTenant
	for rows.Next() {
		var item acs.DeviceTenant
		if err := rows.Scan(
			&item.ID,
			&item.TenantID,
			&item.DeviceID,
			&item.SerialNumber,
			&item.Label,
			&item.ClientID,
			&item.ClientName,
			&item.WiFiSSID,
			&item.WiFiPassword,
			&item.WiFiUpdatedAt,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, &item)
	}
	return list, nil
}

// GetByDeviceID fetches a device registration by its GenieACS device_id.
func (r *ACSDeviceRepository) GetByDeviceID(ctx context.Context, deviceID string) (*acs.DeviceTenant, error) {
	query := `
		SELECT 
			d.id, 
			d.tenant_id, 
			d.device_id, 
			COALESCE(d.serial_number, ''), 
			COALESCE(d.label, ''), 
			d.client_id, 
			COALESCE(c.name, ''), 
			COALESCE(d.wifi_ssid, ''),
			COALESCE(d.wifi_password, ''),
			d.wifi_updated_at,
			d.created_at, 
			d.updated_at
		FROM acs_device_tenants d
		LEFT JOIN clients c ON c.id = d.client_id AND c.deleted_at IS NULL
		WHERE d.device_id = $1
	`
	var item acs.DeviceTenant
	err := r.db.QueryRow(ctx, query, deviceID).Scan(
		&item.ID,
		&item.TenantID,
		&item.DeviceID,
		&item.SerialNumber,
		&item.Label,
		&item.ClientID,
		&item.ClientName,
		&item.WiFiSSID,
		&item.WiFiPassword,
		&item.WiFiUpdatedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrACSDeviceNotFound
		}
		return nil, err
	}
	return &item, nil
}

// Register registers or updates a device assignment for a tenant.
func (r *ACSDeviceRepository) Register(ctx context.Context, dt *acs.DeviceTenant) error {
	existing, err := r.GetByDeviceID(ctx, dt.DeviceID)
	if err == nil {
		// Device is already registered
		if existing.TenantID != dt.TenantID {
			return ErrACSDeviceOwnedByAnotherTenant
		}
		// Update existing record for the same tenant
		updateQuery := `
			UPDATE acs_device_tenants
			SET 
				serial_number = COALESCE(NULLIF($3, ''), serial_number),
				label = $4,
				client_id = $5,
				updated_at = NOW()
			WHERE tenant_id = $1 AND device_id = $2
		`
		_, err := r.db.Exec(ctx, updateQuery, dt.TenantID, dt.DeviceID, dt.SerialNumber, dt.Label, dt.ClientID)
		return err
	}

	if !errors.Is(err, ErrACSDeviceNotFound) {
		return err
	}

	// Insert new registration
	if dt.ID == uuid.Nil {
		dt.ID = uuid.New()
	}
	now := time.Now()
	insertQuery := `
		INSERT INTO acs_device_tenants (id, tenant_id, device_id, serial_number, label, client_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err = r.db.Exec(ctx, insertQuery,
		dt.ID,
		dt.TenantID,
		dt.DeviceID,
		dt.SerialNumber,
		dt.Label,
		dt.ClientID,
		now,
		now,
	)
	return err
}

// Unregister removes a device registration for a tenant.
func (r *ACSDeviceRepository) Unregister(ctx context.Context, tenantID uuid.UUID, deviceID string) error {
	query := `DELETE FROM acs_device_tenants WHERE tenant_id = $1 AND device_id = $2`
	cmdTag, err := r.db.Exec(ctx, query, tenantID, deviceID)
	if err != nil {
		return err
	}
	if cmdTag.RowsAffected() == 0 {
		return ErrACSDeviceNotFound
	}
	return nil
}

// UpdateMetadata updates label and client_id of a tenant's device.
func (r *ACSDeviceRepository) UpdateMetadata(ctx context.Context, tenantID uuid.UUID, deviceID string, label string, clientID *uuid.UUID) error {
	query := `
		UPDATE acs_device_tenants
		SET label = $3, client_id = $4, updated_at = NOW()
		WHERE tenant_id = $1 AND device_id = $2
	`
	cmdTag, err := r.db.Exec(ctx, query, tenantID, deviceID, label, clientID)
	if err != nil {
		return err
	}
	if cmdTag.RowsAffected() == 0 {
		return ErrACSDeviceNotFound
	}
	return nil
}

// UpdateWiFi persists the configured WiFi SSID, password, and timestamp for a tenant's device.
func (r *ACSDeviceRepository) UpdateWiFi(ctx context.Context, tenantID uuid.UUID, deviceID string, ssid, password string) error {
	query := `
		UPDATE acs_device_tenants
		SET wifi_ssid = $3, wifi_password = $4, wifi_updated_at = NOW(), updated_at = NOW()
		WHERE tenant_id = $1 AND device_id = $2
	`
	cmdTag, err := r.db.Exec(ctx, query, tenantID, deviceID, ssid, password)
	if err != nil {
		return err
	}
	if cmdTag.RowsAffected() == 0 {
		return ErrACSDeviceNotFound
	}
	return nil
}

// GetAllRegisteredDeviceIDs returns a map of device_id -> tenant_id for all registered devices.
func (r *ACSDeviceRepository) GetAllRegisteredDeviceIDs(ctx context.Context) (map[string]uuid.UUID, error) {
	query := `SELECT device_id, tenant_id FROM acs_device_tenants`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make(map[string]uuid.UUID)
	for rows.Next() {
		var devID string
		var tenantID uuid.UUID
		if err := rows.Scan(&devID, &tenantID); err != nil {
			return nil, err
		}
		res[devID] = tenantID
	}
	return res, nil
}

type PPPoEClientMapping struct {
	TenantID   uuid.UUID
	ClientID   uuid.UUID
	ClientName string
}

// FindTenantByPPPoE searches for the tenant and client that owns the given PPPoE username.
// Supports format username_slug (e.g. budi_rrnet), username@slug, or plain username with collision safety.
func (r *ACSDeviceRepository) FindTenantByPPPoE(ctx context.Context, username string) (*PPPoEClientMapping, error) {
	cleanUser := strings.TrimSpace(username)
	if cleanUser == "" {
		return nil, errors.New("empty username")
	}

	// Strategy A: If username contains '_' or '@', extract the candidate slug
	// Example: "budi_rrnet" -> prefix="budi", candidateSlug="rrnet"
	var candidateSlug, prefix string
	if lastIdx := strings.LastIndex(cleanUser, "_"); lastIdx > 0 && lastIdx < len(cleanUser)-1 {
		prefix = cleanUser[:lastIdx]
		candidateSlug = cleanUser[lastIdx+1:]
	} else if lastIdx := strings.LastIndex(cleanUser, "@"); lastIdx > 0 && lastIdx < len(cleanUser)-1 {
		prefix = cleanUser[:lastIdx]
		candidateSlug = cleanUser[lastIdx+1:]
	}

	if candidateSlug != "" {
		// 1. Try matching with tenant slug in clients table
		queryWithSlug := `
			SELECT c.tenant_id, c.id, c.name 
			FROM clients c
			JOIN tenants t ON t.id = c.tenant_id
			WHERE LOWER(t.slug) = LOWER($1)
			  AND (LOWER(c.pppoe_username) = LOWER($2) OR LOWER(c.pppoe_username) = LOWER($3))
			  AND c.deleted_at IS NULL
			LIMIT 1
		`
		var m PPPoEClientMapping
		err := r.db.QueryRow(ctx, queryWithSlug, candidateSlug, cleanUser, prefix).Scan(&m.TenantID, &m.ClientID, &m.ClientName)
		if err == nil {
			return &m, nil
		}

		// 2. Try matching with tenant slug in pppoe_secrets table
		querySecretsWithSlug := `
			SELECT s.tenant_id, s.client_id, COALESCE(c.name, '')
			FROM pppoe_secrets s
			JOIN tenants t ON t.id = s.tenant_id
			LEFT JOIN clients c ON c.id = s.client_id AND c.deleted_at IS NULL
			WHERE LOWER(t.slug) = LOWER($1)
			  AND (LOWER(s.username) = LOWER($2) OR LOWER(s.username) = LOWER($3))
			LIMIT 1
		`
		err = r.db.QueryRow(ctx, querySecretsWithSlug, candidateSlug, cleanUser, prefix).Scan(&m.TenantID, &m.ClientID, &m.ClientName)
		if err == nil {
			return &m, nil
		}
	}

	// Strategy B: Direct match without slug extraction.
	// Ambiguity check: If multiple tenants share the same username, reject to prevent cross-tenant stealing.
	queryClients := `
		SELECT c.tenant_id, c.id, c.name
		FROM clients c
		WHERE LOWER(c.pppoe_username) = LOWER($1) AND c.deleted_at IS NULL
	`
	rows, err := r.db.Query(ctx, queryClients, cleanUser)
	if err == nil {
		defer rows.Close()
		var mappings []PPPoEClientMapping
		for rows.Next() {
			var m PPPoEClientMapping
			if scanErr := rows.Scan(&m.TenantID, &m.ClientID, &m.ClientName); scanErr == nil {
				mappings = append(mappings, m)
			}
		}
		if len(mappings) == 1 {
			return &mappings[0], nil
		} else if len(mappings) > 1 {
			return nil, fmt.Errorf("username pppoe %q ambigu (ditemukan di %d tenant)", cleanUser, len(mappings))
		}
	}

	// Fallback to pppoe_secrets
	querySecrets := `
		SELECT s.tenant_id, s.client_id, COALESCE(c.name, '')
		FROM pppoe_secrets s
		LEFT JOIN clients c ON c.id = s.client_id AND c.deleted_at IS NULL
		WHERE LOWER(s.username) = LOWER($1)
	`
	rowsSec, errSec := r.db.Query(ctx, querySecrets, cleanUser)
	if errSec == nil {
		defer rowsSec.Close()
		var mappings []PPPoEClientMapping
		for rowsSec.Next() {
			var m PPPoEClientMapping
			if scanErr := rowsSec.Scan(&m.TenantID, &m.ClientID, &m.ClientName); scanErr == nil {
				mappings = append(mappings, m)
			}
		}
		if len(mappings) == 1 {
			return &mappings[0], nil
		} else if len(mappings) > 1 {
			return nil, fmt.Errorf("username pppoe %q ambigu (ditemukan di %d tenant)", cleanUser, len(mappings))
		}
	}

	return nil, fmt.Errorf("klien dengan username PPPoE %q tidak ditemukan", cleanUser)
}
