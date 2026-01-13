package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/billing"
	"rrnet/internal/repository"
)

// PaymentMatrixEntry represents a client's payment status for a specific month
type PaymentMatrixEntry struct {
	ClientID        uuid.UUID `json:"client_id"`
	ClientName      string    `json:"client_name"`
	ClientGroupName *string   `json:"client_group_name,omitempty"`
	PackageName     *string   `json:"package_name,omitempty"`
	Amount          int64     `json:"amount"`
	Months          [12]PaymentMonthStatus `json:"months"`
}

// PaymentMonthStatus represents payment status for a specific month
type PaymentMonthStatus struct {
	Month  int    `json:"month"`  // 1-12
	Status string `json:"status"` // "paid_on_time", "paid_late", "pending", "overdue", "empty"
	Amount int64  `json:"amount,omitempty"`
}

// PaymentMatrixFilter for filtering payment matrix
type PaymentMatrixFilter struct {
	TenantID   uuid.UUID
	Year       int
	ClientName *string
	GroupID    *uuid.UUID
	Status     *string
}

// GetPaymentMatrix returns payment matrix for all clients for a given year
func (s *BillingService) GetPaymentMatrix(ctx context.Context, filter PaymentMatrixFilter) ([]PaymentMatrixEntry, error) {
	statusMatches := func(cellStatus string, filterStatus string) bool {
		switch filterStatus {
		case "paid":
			return cellStatus == "paid_on_time" || cellStatus == "paid_late"
		case "paid_on_time", "paid_late", "pending", "overdue", "empty", "cancelled":
			return cellStatus == filterStatus
		case "draft":
			return cellStatus == "pending"
		default:
			return cellStatus == filterStatus
		}
	}

	isPaidOnTime := func(paidAt time.Time, dueDate time.Time) bool {
		// dueDate from DB is a DATE; treat it as end-of-day for comparison.
		dueEnd := time.Date(dueDate.Year(), dueDate.Month(), dueDate.Day(), 23, 59, 59, 0, paidAt.Location())
		return !paidAt.After(dueEnd)
	}

	// Get all invoices for the year
	startDate := time.Date(filter.Year, 1, 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(filter.Year, 12, 31, 23, 59, 59, 999999999, time.UTC)

	invoiceFilter := repository.InvoiceFilter{
		TenantID:  filter.TenantID,
		StartDate: &startDate,
		EndDate:   &endDate,
		Page:      1,
		PageSize:  10000, // Large enough to get all invoices
	}
	if filter.ClientName != nil {
		invoiceFilter.ClientName = filter.ClientName
	}
	if filter.GroupID != nil {
		invoiceFilter.GroupID = filter.GroupID
	}
	if filter.Status != nil {
		status := billing.InvoiceStatus(*filter.Status)
		invoiceFilter.Status = &status
	}

	invoices, _, err := s.invoiceRepo.List(ctx, invoiceFilter)
	if err != nil {
		return nil, fmt.Errorf("failed to list invoices: %w", err)
	}

	clients, err := s.clientRepo.ListMatrixClients(ctx, filter.TenantID, filter.ClientName, filter.GroupID)
	if err != nil {
		return nil, fmt.Errorf("failed to list clients for matrix: %w", err)
	}

	// Load items for all invoices (needed for package name)
	// Note: This is done sequentially - could be optimized with batch query if needed
	for _, inv := range invoices {
		items, err := s.invoiceRepo.GetInvoiceItems(ctx, inv.ID)
		if err == nil {
			inv.Items = items
		}
	}

	// Group invoices by client_id and month
	clientMonthMap := make(map[uuid.UUID]map[int]*billing.Invoice)
	for _, inv := range invoices {
		if clientMonthMap[inv.ClientID] == nil {
			clientMonthMap[inv.ClientID] = make(map[int]*billing.Invoice)
		}
		month := int(inv.PeriodStart.Month())
		// If multiple invoices in same month, use the latest one
		if existing := clientMonthMap[inv.ClientID][month]; existing == nil || inv.CreatedAt.After(existing.CreatedAt) {
			clientMonthMap[inv.ClientID][month] = inv
		}
	}

	var entries []PaymentMatrixEntry
	for _, c := range clients {
		entry := PaymentMatrixEntry{
			ClientID:        c.ID,
			ClientName:      c.Name,
			ClientGroupName: c.GroupName,
			PackageName:     nil,
			Amount:          0,
			Months:          [12]PaymentMonthStatus{},
		}

		// Initialize all months as empty
		for i := 0; i < 12; i++ {
			entry.Months[i] = PaymentMonthStatus{
				Month:  i + 1,
				Status: "empty",
			}
		}

		monthInvoices := clientMonthMap[c.ID]
		// Fill in invoice data for each month
		for month, inv := range monthInvoices {
			if month < 1 || month > 12 {
				continue
			}
			idx := month - 1

			// Set package name from first invoice item description
			if entry.PackageName == nil && len(inv.Items) > 0 {
				pkgName := inv.Items[0].Description
				entry.PackageName = &pkgName
			}

			// Set group name from invoice
			if entry.ClientGroupName == nil && inv.ClientGroupName != nil {
				entry.ClientGroupName = inv.ClientGroupName
			}

			// Set amount (use latest invoice amount)
			entry.Amount = inv.TotalAmount

			// Determine status
			status := "pending"
			if inv.Status == billing.InvoiceStatusPaid {
				if inv.PaidAt != nil && isPaidOnTime(*inv.PaidAt, inv.DueDate) {
					status = "paid_on_time"
				} else if inv.PaidAt != nil {
					status = "paid_late"
				} else {
					status = "paid_late"
				}
			} else if inv.Status == billing.InvoiceStatusOverdue {
				status = "overdue"
			} else if inv.Status == billing.InvoiceStatusPending {
				// Check if overdue by comparing due_date with now
				dueEnd := time.Date(inv.DueDate.Year(), inv.DueDate.Month(), inv.DueDate.Day(), 23, 59, 59, 0, time.Local)
				if time.Now().After(dueEnd) {
					status = "overdue"
				} else {
					status = "pending"
				}
			} else if inv.Status == billing.InvoiceStatusDraft {
				status = "pending"
			} else if inv.Status == billing.InvoiceStatusCancelled {
				status = "cancelled"
			}

			entry.Months[idx] = PaymentMonthStatus{
				Month:  month,
				Status: status,
				Amount: inv.TotalAmount,
			}
		}

		// Apply status filter (keep entry if any month matches)
		if filter.Status != nil && *filter.Status != "" {
			keep := false
			for _, m := range entry.Months {
				if statusMatches(m.Status, *filter.Status) {
					keep = true
					break
				}
			}
			if !keep {
				continue
			}
		}

		entries = append(entries, entry)
	}

	return entries, nil
}

