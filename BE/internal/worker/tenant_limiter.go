package worker

import "sync"

// TenantLimiter is an in-process concurrency limiter keyed by tenant ID.
// Note: This limits only within a single worker process. For multi-replica setups,
// a distributed limiter can be added later.
type TenantLimiter struct {
	max int
	m   sync.Map // map[string]chan struct{}
}

func NewTenantLimiter(maxPerTenant int) *TenantLimiter {
	if maxPerTenant < 1 {
		maxPerTenant = 1
	}
	return &TenantLimiter{max: maxPerTenant}
}

func (l *TenantLimiter) acquire(tenantID string) func() {
	chAny, _ := l.m.LoadOrStore(tenantID, make(chan struct{}, l.max))
	ch := chAny.(chan struct{})
	ch <- struct{}{}
	return func() { <-ch }
}


