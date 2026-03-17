package service

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/domain/network"
	"rrnet/internal/domain/voucher"
	"rrnet/internal/infra/mikrotik"
)

type UpdateVoucherRequest struct {
	ID          uuid.UUID `json:"id"`
	PackageID   uuid.UUID `json:"package_id"`
	Code        string    `json:"code"`
	Password    string    `json:"password"`
	SharedUsers int       `json:"shared_users"`
	Notes       string    `json:"notes"`
}

func (s *VoucherService) UpdateVoucher(ctx context.Context, tenantID uuid.UUID, req UpdateVoucherRequest) (*voucher.Voucher, error) {
	// 1. Get existing voucher
	v, err := s.voucherRepo.GetVoucherByID(ctx, req.ID)
	if err != nil {
		return nil, fmt.Errorf("voucher not found: %w", err)
	}

	// 2. Refresh package details (new or old)
	pkg, err := s.voucherRepo.GetPackageByID(ctx, req.PackageID)
	if err != nil {
		return nil, fmt.Errorf("package not found: %w", err)
	}

	oldCode := v.Code
	// oldPassword := v.Password

	// 3. Update fields
	v.PackageID = req.PackageID
	v.Code = req.Code
	v.Password = req.Password
	v.SharedUsers = req.SharedUsers
	v.Notes = req.Notes
	v.UpdatedAt = time.Now()

	// 4. Update DB
	if err := s.voucherRepo.UpdateVoucher(ctx, v); err != nil {
		return nil, fmt.Errorf("failed to update voucher in db: %w", err)
	}

	// 5. Sync to MikroTik if applicable
	if pkg.RateLimitMode == "radius_auth_only" {
		// Prepare HotspotUser struct
		hotspotUser := mikrotik.HotspotUser{
			Name:        v.Code,
			Password:    v.Password,
			Profile:     pkg.Name,
			Comment:     fmt.Sprintf("RRNET Voucher - Updated %s", v.UpdatedAt.Format("2006-01-02 15:04:05")),
			SharedUsers: v.SharedUsers,
		}

		// Function to update user on a router
		updateRouter := func(router *network.Router) {
			if router.Status != network.RouterStatusOnline {
				return
			}
			addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
			userCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			defer cancel()

			// Call UpdateHotspotUser
			err := mikrotik.UpdateHotspotUser(userCtx, addr, router.APIUseTLS, router.Username, router.Password, oldCode, hotspotUser)
			if err != nil {
				log.Warn().
					Err(err).
					Str("router", router.Name).
					Str("old_code", oldCode).
					Str("new_code", v.Code).
					Msg("Failed to update Hotspot user on router")
			} else {
				log.Info().
					Str("router", router.Name).
					Str("code", v.Code).
					Msg("Updated Hotspot user on router")
			}
		}

		if v.RouterID != nil {
			// Sync to specific router
			router, err := s.routerRepo.GetByID(ctx, *v.RouterID)
			if err == nil {
				updateRouter(router)
			}
		} else {
			// Sync to all routers
			routers, err := s.routerRepo.ListByTenant(ctx, tenantID)
			if err == nil {
				for _, router := range routers {
					updateRouter(router)
				}
			}
		}
	}

	return v, nil
}
