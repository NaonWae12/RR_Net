package radius

import (
	"time"

	"github.com/google/uuid"
)

type AuthResult string

const (
	AuthResultAccept AuthResult = "accept"
	AuthResultReject AuthResult = "reject"
	AuthResultError  AuthResult = "error"
)

type AuthAttempt struct {
	ID                uuid.UUID  `json:"id"`
	TenantID          uuid.UUID  `json:"tenant_id"`
	RouterID          *uuid.UUID `json:"router_id,omitempty"`
	Username          string     `json:"username"`
	NASIPAddress      string     `json:"nas_ip_address,omitempty"`
	NASPortID         string     `json:"nas_port_id,omitempty"`
	CallingStationID  string     `json:"calling_station_id,omitempty"` // Client MAC
	CalledStationID   string     `json:"called_station_id,omitempty"`  // AP MAC
	AuthResult        AuthResult `json:"auth_result"`
	RejectReason      string     `json:"reject_reason,omitempty"`
	VoucherID         *uuid.UUID `json:"voucher_id,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

type SessionStatus string

const (
	SessionStatusActive  SessionStatus = "active"
	SessionStatusStopped SessionStatus = "stopped"
)

type Session struct {
	ID                   uuid.UUID     `json:"id"`
	TenantID             uuid.UUID     `json:"tenant_id"`
	RouterID             *uuid.UUID    `json:"router_id,omitempty"`
	VoucherID            *uuid.UUID    `json:"voucher_id,omitempty"`
	AcctSessionID        string        `json:"acct_session_id"`
	AcctUniqueID         string        `json:"acct_unique_id,omitempty"`
	Username             string        `json:"username"`
	NASIPAddress         string        `json:"nas_ip_address,omitempty"`
	NASPortID            string        `json:"nas_port_id,omitempty"`
	FramedIPAddress      string        `json:"framed_ip_address,omitempty"`
	CallingStationID     string        `json:"calling_station_id,omitempty"`
	CalledStationID      string        `json:"called_station_id,omitempty"`
	AcctStartTime        *time.Time    `json:"acct_start_time,omitempty"`
	AcctStopTime         *time.Time    `json:"acct_stop_time,omitempty"`
	AcctSessionTime      *int          `json:"acct_session_time,omitempty"`
	AcctInputOctets      int64         `json:"acct_input_octets"`
	AcctOutputOctets     int64         `json:"acct_output_octets"`
	AcctInputPackets     int64         `json:"acct_input_packets"`
	AcctOutputPackets    int64         `json:"acct_output_packets"`
	AcctTerminateCause   string        `json:"acct_terminate_cause,omitempty"`
	SessionStatus        SessionStatus `json:"session_status"`
	CreatedAt            time.Time     `json:"created_at"`
	UpdatedAt            time.Time     `json:"updated_at"`
}

