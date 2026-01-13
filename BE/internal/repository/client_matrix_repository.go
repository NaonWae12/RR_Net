package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// MatrixClient is a lightweight client projection for the payment matrix view.
type MatrixClient struct {
	ID        uuid.UUID
	Name      string
	GroupName *string
}

// ListMatrixClients returns clients for matrix view with optional search and group filter.
// Note: This is tenant-scoped and excludes soft-deleted clients.
func (r *ClientRepository) ListMatrixClients(ctx context.Context, tenantID uuid.UUID, search *string, groupID *uuid.UUID) ([]MatrixClient, error) {
	baseQuery := `
		FROM clients c
		LEFT JOIN client_groups g ON g.id = c.group_id
		WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
	`
	args := []interface{}{tenantID}
	argIdx := 2

	if search != nil && *search != "" {
		baseQuery += fmt.Sprintf(" AND (c.name ILIKE $%d OR c.phone ILIKE $%d OR c.client_code ILIKE $%d)", argIdx, argIdx, argIdx)
		args = append(args, "%"+*search+"%")
		argIdx++
	}
	if groupID != nil {
		baseQuery += fmt.Sprintf(" AND c.group_id = $%d", argIdx)
		args = append(args, *groupID)
		argIdx++
	}

	query := `
		SELECT c.id, c.name, g.name as group_name
	` + baseQuery + `
		ORDER BY c.name ASC
		LIMIT 10000
	`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []MatrixClient
	for rows.Next() {
		var c MatrixClient
		if err := rows.Scan(&c.ID, &c.Name, &c.GroupName); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}




