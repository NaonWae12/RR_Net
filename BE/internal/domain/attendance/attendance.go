package attendance

import (
	"time"

	"github.com/google/uuid"
)

type AttendanceStatus string

const (
	StatusCheckedIn  AttendanceStatus = "checked_in"
	StatusCheckedOut AttendanceStatus = "checked_out"
	StatusAbsent     AttendanceStatus = "absent"
	StatusOnLeave    AttendanceStatus = "on_leave"
)

type Attendance struct {
	ID                uuid.UUID        `json:"id"`
	TenantID          uuid.UUID        `json:"tenant_id"`
	UserID            uuid.UUID        `json:"user_id"`
	Date              time.Time        `json:"date"`
	CheckInTime       *time.Time       `json:"check_in_time"`
	CheckOutTime      *time.Time       `json:"check_out_time"`
	Status            AttendanceStatus `json:"status"`
	CheckInLatitude   *float64         `json:"check_in_latitude"`
	CheckInLongitude  *float64         `json:"check_in_longitude"`
	CheckOutLatitude  *float64         `json:"check_out_latitude"`
	CheckOutLongitude *float64         `json:"check_out_longitude"`
	Note              string           `json:"note"`
	TotalHours        *float64         `json:"total_hours"`
	CreatedAt         time.Time        `json:"created_at"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

type AttendanceSettings struct {
	TenantID           uuid.UUID  `json:"tenant_id"`
	Enabled            bool       `json:"enabled"`
	RequireGeolocation bool       `json:"require_geolocation"`
	RadiusMeters       int        `json:"radius_meters"`
	AllowedLocations   []Location `json:"allowed_locations"`
	UpdatedAt          time.Time  `json:"updated_at"`
	UpdatedBy          uuid.UUID  `json:"updated_by"`
}

type Location struct {
	Name         string  `json:"name"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	RadiusMeters *int    `json:"radius_meters,omitempty"`
}
