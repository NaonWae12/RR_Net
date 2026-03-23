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
	"rrnet/internal/infra/mikrotik"
	"rrnet/internal/repository"
	"rrnet/pkg/utils"
)

type RouterDecommissionService struct {
	routerRepo  *repository.RouterRepository
	syncRepo    *repository.RouterSyncRepository
	pppoeRepo   *repository.PPPoERepository
	voucherRepo *repository.VoucherRepository
	profileRepo *repository.NetworkProfileRepository
	encKey32    [32]byte
}

func NewRouterDecommissionService(
	routerRepo *repository.RouterRepository,
	syncRepo *repository.RouterSyncRepository,
	pppoeRepo *repository.PPPoERepository,
	voucherRepo *repository.VoucherRepository,
	profileRepo *repository.NetworkProfileRepository,
	encryptionSecret string,
) *RouterDecommissionService {
	return &RouterDecommissionService{
		routerRepo:  routerRepo,
		syncRepo:    syncRepo,
		pppoeRepo:   pppoeRepo,
		voucherRepo: voucherRepo,
		profileRepo: profileRepo,
		encKey32:    utils.DeriveKey32(encryptionSecret),
	}
}

// StartDecommission initiates the background synchronization process
func (s *RouterDecommissionService) StartDecommission(ctx context.Context, routerID uuid.UUID, targetRouterID *uuid.UUID) error {
	// 1. Mark router as decommissioning
	err := s.routerRepo.UpdateStatus(ctx, routerID, network.RouterStatusDecommissioning)
	if err != nil {
		return fmt.Errorf("failed to update router status: %w", err)
	}

	// 2. Scan all PPPoE secrets tied to this router
	pppoes, err := s.pppoeRepo.ListByRouter(ctx, routerID)
	if err != nil {
		return fmt.Errorf("failed to list pppoe secrets: %w", err)
	}

	// 3. Scan all Vouchers tied to this router
	vouchers, err := s.voucherRepo.ListByRouter(ctx, routerID)
	if err != nil {
		return fmt.Errorf("failed to list vouchers: %w", err)
	}

	// 4. Create Sync Tasks
	var tasks []*network.RouterDecommissionTask
	now := time.Now()

	for _, p := range pppoes {
		tasks = append(tasks, &network.RouterDecommissionTask{
			ID:             uuid.New(),
			RouterID:       routerID,
			TargetRouterID: targetRouterID,
			TaskType:       network.DecommissionTaskPPPoE,
			ReferenceID:    p.ID,
			Status:         network.DecommissionTaskPending,
			CreatedAt:      now,
			UpdatedAt:      now,
		})
	}

	for _, v := range vouchers {
		tasks = append(tasks, &network.RouterDecommissionTask{
			ID:             uuid.New(),
			RouterID:       routerID,
			TargetRouterID: targetRouterID,
			TaskType:       network.DecommissionTaskVoucher,
			ReferenceID:    v.ID,
			Status:         network.DecommissionTaskPending,
			CreatedAt:      now,
			UpdatedAt:      now,
		})
	}

	if len(tasks) > 0 {
		err = s.syncRepo.BulkCreateTasks(ctx, tasks)
		if err != nil {
			return fmt.Errorf("failed to create sync tasks: %w", err)
		}
	} else {
		// If no tasks, we can finish decommissioning immediately
		return s.routerRepo.Delete(ctx, routerID)
	}

	// 5. Start Background Worker (Go routine)
	go s.runWorker(context.Background(), routerID)

	return nil
}

func (s *RouterDecommissionService) runWorker(ctx context.Context, routerID uuid.UUID) {
	log.Info().Str("router_id", routerID.String()).Msg("Starting decommission worker")

	for {
		// Pull batch of tasks
		tasks, err := s.syncRepo.GetPendingTasks(ctx, routerID, 10)
		if err != nil {
			log.Error().Err(err).Msg("Worker failed to pull tasks")
			time.Sleep(10 * time.Second)
			continue
		}

		if len(tasks) == 0 {
			// Check if ALL tasks for this router are COMPLETED
			comp, total, err := s.syncRepo.GetRouterProgress(ctx, routerID)
			if err == nil && comp == total && total > 0 {
				log.Info().Str("router_id", routerID.String()).Msg("Decommissioning 100% complete. Revoking router.")
				_ = s.routerRepo.Delete(ctx, routerID)
				return
			}
			
			if total == 0 { return }

			log.Debug().Msg("No pending tasks, waiting...")
			time.Sleep(5 * time.Second)
			continue
		}

		for _, task := range tasks {
			_ = s.syncRepo.UpdateTaskStatus(ctx, task.ID, network.DecommissionTaskProcessing, "")
			
			var err error
			switch task.TaskType {
			case network.DecommissionTaskPPPoE:
				err = s.processPPPoESync(ctx, task)
			case network.DecommissionTaskVoucher:
				err = s.processVoucherSync(ctx, task)
			}

			if err != nil {
				_ = s.syncRepo.UpdateTaskStatus(ctx, task.ID, network.DecommissionTaskFailed, err.Error())
			} else {
				_ = s.syncRepo.UpdateTaskStatus(ctx, task.ID, network.DecommissionTaskCompleted, "")
			}
		}

		time.Sleep(100 * time.Millisecond)
	}
}

func (s *RouterDecommissionService) processPPPoESync(ctx context.Context, task *network.RouterDecommissionTask) error {
	secret, err := s.pppoeRepo.GetByID(ctx, task.ReferenceID)
	if err != nil { return err }

	// 1. Remove from Old MikroTik
	oldRouter, err := s.routerRepo.GetByID(ctx, task.RouterID)
	if err == nil {
		addr := net.JoinHostPort(oldRouter.Host, strconv.Itoa(oldRouter.APIPort))
		_ = mikrotik.RemovePPPoESecret(ctx, addr, oldRouter.APIUseTLS, oldRouter.Username, oldRouter.Password, secret.Username)
	}

	// 2. Add to New MikroTik (if targetRouterID exists)
	if task.TargetRouterID != nil {
		newRouter, err := s.routerRepo.GetByID(ctx, *task.TargetRouterID)
		if err != nil { return err }

		profile, err := s.profileRepo.GetByID(ctx, secret.ProfileID)
		if err != nil { return err }

		plainPassword, err := utils.DecryptStringAESGCM(s.encKey32, secret.Password)
		if err != nil { return err }

		addr := net.JoinHostPort(newRouter.Host, strconv.Itoa(newRouter.APIPort))
		mSecret := mikrotik.PPPoESecret{
			Username:      secret.Username,
			Password:      plainPassword,
			Profile:       profile.Name,
			Service:       secret.Service,
			CallerID:      secret.CallerID,
			RemoteAddress: secret.RemoteAddress,
			LocalAddress:  secret.LocalAddress,
			Comment:       secret.Comment,
			Disabled:      secret.IsDisabled,
		}

		err = mikrotik.AddPPPoESecret(ctx, addr, newRouter.APIUseTLS, newRouter.Username, newRouter.Password, mSecret)
		if err != nil { return err }
		
		secret.RouterID = *task.TargetRouterID
		return s.pppoeRepo.Update(ctx, secret)
	} else {
		secret.IsDisabled = true
		return s.pppoeRepo.Update(ctx, secret)
	}
}

func (s *RouterDecommissionService) processVoucherSync(ctx context.Context, task *network.RouterDecommissionTask) error {
	v, err := s.voucherRepo.GetVoucherByID(ctx, task.ReferenceID)
	if err != nil { return err }

	// 1. Disconnect from old router if any
	oldRouter, err := s.routerRepo.GetByID(ctx, task.RouterID)
	if err == nil {
		addr := net.JoinHostPort(oldRouter.Host, strconv.Itoa(oldRouter.APIPort))
		_ = mikrotik.RemoveHotspotActiveByUser(ctx, addr, oldRouter.APIUseTLS, oldRouter.Username, oldRouter.Password, v.Code)
		// Also remove temporary user if it was radius_auth_only
		_ = mikrotik.RemoveHotspotUser(ctx, addr, oldRouter.APIUseTLS, oldRouter.Username, oldRouter.Password, v.Code)
	}

	// 2. Update DB
	v.RouterID = task.TargetRouterID
	return s.voucherRepo.UpdateVoucher(ctx, v)
}

func (s *RouterDecommissionService) GetProgress(ctx context.Context, routerID uuid.UUID) (completed int, total int, err error) {
	return s.syncRepo.GetRouterProgress(ctx, routerID)
}

