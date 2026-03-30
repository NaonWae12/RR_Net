package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"

	"rrnet/internal/domain/attendance"
	"rrnet/internal/repository"
)

type AttendanceService struct {
	attendanceRepo *repository.AttendanceRepository
}

func NewAttendanceService(attendanceRepo *repository.AttendanceRepository) *AttendanceService {
	return &AttendanceService{
		attendanceRepo: attendanceRepo,
	}
}

type CheckInRequest struct {
	Note      string   `json:"note,omitempty"`
	Latitude  *float64 `json:"location_latitude,omitempty"`
	Longitude *float64 `json:"location_longitude,omitempty"`
}

type CheckOutRequest struct {
	Note      string   `json:"note,omitempty"`
	Latitude  *float64 `json:"location_latitude,omitempty"`
	Longitude *float64 `json:"location_longitude,omitempty"`
}

func (s *AttendanceService) CheckIn(ctx context.Context, tenantID, userID uuid.UUID, req CheckInRequest) (*attendance.Attendance, error) {
	now := time.Now()
	today := now.Truncate(24 * time.Hour)

	// Check if already checked in
	_, err := s.attendanceRepo.GetToday(ctx, userID, today)
	if err == nil {
		return nil, fmt.Errorf("already checked in for today")
	}

	// Validate settings
	settings, err := s.attendanceRepo.GetSettings(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get attendance settings: %w", err)
	}

	if !settings.Enabled {
		return nil, fmt.Errorf("attendance feature is currently disabled by administrator")
	}

	if settings.RequireGeolocation {
		if req.Latitude == nil || req.Longitude == nil {
			return nil, fmt.Errorf("geolocation is required for check-in")
		}

		// Check if within radius of any allowed location
		if len(settings.AllowedLocations) > 0 {
			inRange := false
			var closestDist float64 = -1
			var usedRadius float64

			for _, loc := range settings.AllowedLocations {
				dist := calculateDistance(*req.Latitude, *req.Longitude, loc.Latitude, loc.Longitude)

				radius := float64(settings.RadiusMeters)
				if loc.RadiusMeters != nil && *loc.RadiusMeters > 0 {
					radius = float64(*loc.RadiusMeters)
				}

				// Safety: Ensure radius is at least 10 meters if enabled
				if radius < 10 {
					radius = 100 // Fallback to 100m if something is wrong
				}

				if closestDist < 0 || dist < closestDist {
					closestDist = dist
					usedRadius = radius
				}

				if dist <= radius {
					inRange = true
					break
				}
			}
			if !inRange {
				fmt.Printf("[DEBUG] Geofence Reject: Closest dist %.2fm, Allowed radius %.2fm\n", closestDist, usedRadius)
				return nil, fmt.Errorf("you are not within the allowed attendance area (closest distance: %.2fm, allowed: %.2fm)", closestDist, usedRadius)
			}
		}
	}

	a := &attendance.Attendance{
		ID:               uuid.New(),
		TenantID:         tenantID,
		UserID:           userID,
		Date:             today,
		CheckInTime:      &now,
		Status:           attendance.StatusCheckedIn,
		CheckInLatitude:  req.Latitude,
		CheckInLongitude: req.Longitude,
		Note:             req.Note,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := s.attendanceRepo.Create(ctx, a); err != nil {
		return nil, fmt.Errorf("failed to create attendance: %w", err)
	}

	return a, nil
}

func (s *AttendanceService) CheckOut(ctx context.Context, tenantID, userID uuid.UUID, req CheckOutRequest) (*attendance.Attendance, error) {
	now := time.Now()
	today := now.Truncate(24 * time.Hour)

	a, err := s.attendanceRepo.GetToday(ctx, userID, today)
	if err != nil {
		return nil, fmt.Errorf("not checked in for today: %w", err)
	}

	settings, err := s.attendanceRepo.GetSettings(ctx, a.TenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to get attendance settings: %w", err)
	}
	if !settings.Enabled {
		return nil, fmt.Errorf("attendance feature is currently disabled by administrator")
	}

	if a.Status == attendance.StatusCheckedOut {
		return nil, fmt.Errorf("already checked out for today")
	}

	a.CheckOutTime = &now
	a.Status = attendance.StatusCheckedOut
	a.CheckOutLatitude = req.Latitude
	a.CheckOutLongitude = req.Longitude
	if req.Note != "" {
		if a.Note != "" {
			a.Note += "\n\n" + req.Note
		} else {
			a.Note = req.Note
		}
	}

	// Calculate total hours
	if a.CheckInTime != nil {
		duration := a.CheckOutTime.Sub(*a.CheckInTime)
		hours := duration.Hours()
		a.TotalHours = &hours
	}

	a.UpdatedAt = now

	if err := s.attendanceRepo.Update(ctx, a); err != nil {
		return nil, fmt.Errorf("failed to update attendance: %w", err)
	}

	return a, nil
}

func (s *AttendanceService) GetTodayAttendance(ctx context.Context, userID uuid.UUID) (*attendance.Attendance, error) {
	return s.attendanceRepo.GetToday(ctx, userID, time.Now().Truncate(24*time.Hour))
}

func (s *AttendanceService) ListAttendance(ctx context.Context, userID uuid.UUID, startDate, endDate string) ([]*attendance.Attendance, error) {
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, fmt.Errorf("invalid start date")
	}
	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, fmt.Errorf("invalid end date")
	}

	return s.attendanceRepo.List(ctx, userID, start, end)
}

func (s *AttendanceService) ListAllAttendance(ctx context.Context, tenantID uuid.UUID, startDate, endDate string) ([]any, error) {
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, fmt.Errorf("invalid start date")
	}
	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, fmt.Errorf("invalid end date")
	}

	return s.attendanceRepo.ListByTenant(ctx, tenantID, start, end)
}

// Settings

func (s *AttendanceService) GetSettings(ctx context.Context, tenantID uuid.UUID) (*attendance.AttendanceSettings, error) {
	return s.attendanceRepo.GetSettings(ctx, tenantID)
}

func (s *AttendanceService) UpdateSettings(ctx context.Context, tenantID, userID uuid.UUID, settings *attendance.AttendanceSettings) error {
	settings.TenantID = tenantID
	settings.UpdatedBy = userID
	settings.UpdatedAt = time.Now()
	return s.attendanceRepo.SaveSettings(ctx, settings)
}

// Utility

func calculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371000 // Earth radius in meters
	phi1 := lat1 * math.Pi / 180
	phi2 := lat2 * math.Pi / 180
	deltaPhi := (lat2 - lat1) * math.Pi / 180
	deltaLambda := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(deltaPhi/2)*math.Sin(deltaPhi/2) +
		math.Cos(phi1)*math.Cos(phi2)*
			math.Sin(deltaLambda/2)*math.Sin(deltaLambda/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}
