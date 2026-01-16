package service

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"

	"rrnet/internal/repository"
)

// ClientCleanupScheduler handles weekly cleanup of soft-deleted clients
type ClientCleanupScheduler struct {
	clientRepo    *repository.ClientRepository
	retentionDays int
	runDay        time.Weekday
	runTime       string // e.g., "00:10"
}

// NewClientCleanupScheduler creates a new client cleanup scheduler
func NewClientCleanupScheduler(
	clientRepo *repository.ClientRepository,
	retentionDays int,
	runDay time.Weekday,
	runTime string,
) *ClientCleanupScheduler {
	return &ClientCleanupScheduler{
		clientRepo:    clientRepo,
		retentionDays: retentionDays,
		runDay:        runDay,
		runTime:       runTime,
	}
}

// StartWeeklyScheduler starts a goroutine that runs the cleanup job weekly
func (s *ClientCleanupScheduler) StartWeeklyScheduler(ctx context.Context) {
	go func() {
		// Run once on startup (helps recovery if server was down at scheduled time)
		s.runCleanupJob(ctx)

		for {
			now := time.Now()
			nextRun := s.calculateNextRun(now)

			timer := time.NewTimer(time.Until(nextRun))
			select {
			case <-ctx.Done():
				timer.Stop()
				log.Info().Msg("Client cleanup scheduler stopped")
				return
			case <-timer.C:
				s.runCleanupJob(ctx)
			}
		}
	}()
	log.Info().
		Int("retention_days", s.retentionDays).
		Str("run_day", s.runDay.String()).
		Str("run_time", s.runTime).
		Msg("Client cleanup scheduler started (runs weekly)")
}

// calculateNextRun calculates the next run time based on runDay and runTime
func (s *ClientCleanupScheduler) calculateNextRun(now time.Time) time.Time {
	// Parse run time (HH:MM format) - we only need hour and minute
	hour := 0
	minute := 10
	if parts := len(s.runTime); parts >= 5 {
		if _, err := fmt.Sscanf(s.runTime, "%d:%d", &hour, &minute); err != nil {
			log.Error().Err(err).Str("runTime", s.runTime).Msg("Invalid run time format, defaulting to 00:10")
			hour = 0
			minute = 10
		}
	}

	// Calculate days until next run day
	daysUntilRunDay := int(s.runDay) - int(now.Weekday())
	if daysUntilRunDay < 0 {
		daysUntilRunDay += 7 // Next week
	} else if daysUntilRunDay == 0 {
		// Same day - check if time has passed
		targetTime := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, time.Local)
		if targetTime.Before(now) || targetTime.Equal(now) {
			daysUntilRunDay = 7 // Next week
		}
	}

	// Calculate next run time
	nextRun := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, time.Local)
	nextRun = nextRun.AddDate(0, 0, daysUntilRunDay)

	return nextRun
}

// runCleanupJob executes the cleanup job to hard delete old soft-deleted clients
func (s *ClientCleanupScheduler) runCleanupJob(ctx context.Context) {
	jobCtx, cancel := context.WithTimeout(ctx, 5*time.Minute) // 5-minute timeout for the whole job
	defer cancel()

	log.Info().Int("retention_days", s.retentionDays).Msg("Starting client cleanup job")
	defer log.Info().Msg("Client cleanup job finished")

	deletedCount, err := s.clientRepo.HardDeleteOldSoftDeleted(jobCtx, s.retentionDays)
	if err != nil {
		log.Error().Err(err).Msg("Client cleanup job failed")
		return
	}

	log.Info().
		Int64("deleted_count", deletedCount).
		Int("retention_days", s.retentionDays).
		Msg("Client cleanup job completed")
}
