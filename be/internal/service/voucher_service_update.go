package service

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rrnet/internal/domain/network"
	"rrnet/internal/domain/voucher"
	"rrnet/internal/infra/mikrotik"
)

type UpdateVoucherRequest struct {
	ID          uuid.UUID  `json:"id"`
	PackageID   uuid.UUID  `json:"package_id"`
	RouterID    *uuid.UUID `json:"router_id,omitempty"`
	Code        string     `json:"code"`
	Password    string     `json:"password"`
	SharedUsers int        `json:"shared_users"`
	Notes       string     `json:"notes"`
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
	oldRouterID := v.RouterID
	newRouterID := req.RouterID

	// 3. Update fields
	v.PackageID = req.PackageID
	v.RouterID = req.RouterID
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

		// Function to update/add user on a router
		upsertRouter := func(router *network.Router) {
			if router.Status != network.RouterStatusOnline {
				return
			}
			addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
			userCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			defer cancel()

			// Try update first
			err := mikrotik.UpdateHotspotUser(userCtx, addr, router.APIUseTLS, router.Username, router.Password, oldCode, hotspotUser)
			if err != nil {
				if strings.Contains(strings.ToLower(err.Error()), "not found") {
					// User not found, try add
					err = mikrotik.AddHotspotUser(userCtx, addr, router.APIUseTLS, router.Username, router.Password, hotspotUser)
					if err != nil {
						log.Warn().Err(err).Str("router", router.Name).Str("code", v.Code).Msg("Failed to add Hotspot user on router")
					}
				} else {
					log.Warn().Err(err).Str("router", router.Name).Str("code", v.Code).Msg("Failed to update Hotspot user on router")
				}
			}
		}

		// Function to remove user from a router
		removeRouter := func(routerID uuid.UUID) {
			router, err := s.routerRepo.GetByID(ctx, routerID)
			if err != nil || router.Status != network.RouterStatusOnline {
				return
			}
			addr := net.JoinHostPort(router.Host, strconv.Itoa(router.APIPort))
			userCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			defer cancel()
			_ = mikrotik.RemoveHotspotUser(userCtx, addr, router.APIUseTLS, router.Username, router.Password, oldCode)
		}

		// Logic for Router Migration
		routerChanged := false
		if oldRouterID != nil && newRouterID != nil {
			routerChanged = *oldRouterID != *newRouterID
		} else if (oldRouterID == nil && newRouterID != nil) || (oldRouterID != nil && newRouterID == nil) {
			routerChanged = true
		}

		if routerChanged {
			// 1. Remove from old target(s)
			if oldRouterID != nil {
				removeRouter(*oldRouterID)
			} else {
				// Was "All Routers", remove from all
				routers, _ := s.routerRepo.ListByTenant(ctx, tenantID)
				for _, r := range routers {
					removeRouter(r.ID)
				}
			}

			// 2. Add to new target(s)
			if newRouterID != nil {
				router, err := s.routerRepo.GetByID(ctx, *newRouterID)
				if err == nil {
					upsertRouter(router)
				}
			} else {
				// Now "All Routers", add to all
				routers, _ := s.routerRepo.ListByTenant(ctx, tenantID)
				for _, r := range routers {
					upsertRouter(r)
				}
			}
		} else {
			// Router didn't change, just update existing target(s)
			if v.RouterID != nil {
				router, err := s.routerRepo.GetByID(ctx, *v.RouterID)
				if err == nil {
					upsertRouter(router)
				}
			} else {
				routers, err := s.routerRepo.ListByTenant(ctx, tenantID)
				if err == nil {
					for _, router := range routers {
						upsertRouter(router)
					}
				}
			}
		}
	}

	return v, nil
}
