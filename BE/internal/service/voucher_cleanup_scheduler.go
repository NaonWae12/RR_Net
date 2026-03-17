package service

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"

	"rrnet/internal/repository"
)

// VoucherCleanupScheduler handles periodic hard deletion of expired vouchers
type VoucherCleanupScheduler struct {
	voucherRepo    *repository.VoucherRepository
	retentionDays int
	runTime       string // e.g., "01:15"
}

// NewVoucherCleanupScheduler creates a new voucher cleanup scheduler
func NewVoucherCleanupScheduler(
	voucherRepo *repository.VoucherRepository,
	retentionDays int,
	runTime string,
) *VoucherCleanupScheduler {
	return &VoucherCleanupScheduler{
		voucherRepo:    voucherRepo,
		retentionDays: retentionDays,
		runTime:       runTime,
	}
}

// StartDailyScheduler starts a goroutine that runs the cleanup job daily
func (s *VoucherCleanupScheduler) StartDailyScheduler(ctx context.Context) {
	go func() {
		// Run once on startup
		s.runCleanupJob(ctx)

		for {
			now := time.Now()
			nextRun := s.calculateNextRun(now)

			timer := time.NewTimer(time.Until(nextRun))
			select {
			case <-ctx.Done():
				timer.Stop()
				log.Info().Msg("Voucher cleanup scheduler stopped")
				return
			case <-timer.C:
				s.runCleanupJob(ctx)
			}
		}
	}()
	log.Info().
		Int("retention_days", s.retentionDays).
		Str("run_time", s.runTime).
		Msg("Voucher cleanup scheduler started (runs daily)")
}

// calculateNextRun calculates the next run time based on runTime
func (s *VoucherCleanupScheduler) calculateNextRun(now time.Time) time.Time {
	hour := 1
	minute := 15
	if parts := len(s.runTime); parts >= 5 {
		if _, err := fmt.Sscanf(s.runTime, "%d:%d", &hour, &minute); err != nil {
			log.Error().Err(err).Str("runTime", s.runTime).Msg("Invalid run time format, defaulting to 01:15")
			hour = 1
			minute = 15
		}
	}

	nextRun := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, time.Local)
	if nextRun.Before(now) || nextRun.Equal(now) {
		nextRun = nextRun.AddDate(0, 0, 1) // Tomorrow
	}

	return nextRun
}

// runCleanupJob executes the cleanup job to hard delete old expired vouchers
func (s *VoucherCleanupScheduler) runCleanupJob(ctx context.Context) {
	jobCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	retentionDuration := time.Duration(s.retentionDays) * 24 * time.Hour
	olderThan := time.Now().Add(-retentionDuration)

	log.Info().
		Int("retention_days", s.retentionDays).
		Time("older_than", olderThan).
		Msg("Starting voucher cleanup job")
	
	defer log.Info().Msg("Voucher cleanup job finished")

	deletedCount, err := s.voucherRepo.HardDeleteExpiredVouchers(jobCtx, olderThan)
	if err != nil {
		log.Error().Err(err).Msg("Voucher cleanup job failed")
		return
	}

	log.Info().
		Int64("deleted_count", deletedCount).
		Int("retention_days", s.retentionDays).
		Msg("Voucher cleanup job completed")
}
