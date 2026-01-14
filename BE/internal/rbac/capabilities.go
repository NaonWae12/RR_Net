package rbac

// Capability represents a permission to perform an action
type Capability string

// Capability categories
const (
	// Tenant capabilities
	CapTenantView   Capability = "tenant.view"
	CapTenantUpdate Capability = "tenant.update"
	CapTenantCreate Capability = "tenant.create"
	CapTenantDelete Capability = "tenant.delete"

	// User capabilities
	CapUserCreate  Capability = "user.create"
	CapUserUpdate  Capability = "user.update"
	CapUserDisable Capability = "user.disable"
	CapUserView    Capability = "user.view"
	CapUserDelete  Capability = "user.delete"

	// Client capabilities
	CapClientCreate  Capability = "client.create"
	CapClientUpdate  Capability = "client.update"
	CapClientView    Capability = "client.view"
	CapClientSuspend Capability = "client.suspend"
	CapClientDelete  Capability = "client.delete"

	// Billing capabilities
	CapBillingView    Capability = "billing.view"
	CapBillingCollect Capability = "billing.collect"
	CapBillingConfirm Capability = "billing.confirm"
	CapBillingCreate  Capability = "billing.create"
	CapBillingUpdate  Capability = "billing.update"

	// Network capabilities
	CapNetworkView   Capability = "network.view"
	CapNetworkManage Capability = "network.manage"

	// Maps capabilities
	CapMapsView   Capability = "maps.view"
	CapMapsUpdate Capability = "maps.update"

	// HR capabilities
	CapHRView   Capability = "hr.view"
	CapHRManage Capability = "hr.manage"

	// Technician capabilities
	CapTechnicianView   Capability = "technician.view"
	CapTechnicianManage Capability = "technician.manage"

	// Collector capabilities
	CapCollectorView   Capability = "collector.view"
	CapCollectorManage Capability = "collector.manage"

	// WA Gateway capabilities
	CapWAView Capability = "wa.view"
	CapWASend Capability = "wa.send"

	// Addon capabilities
	CapAddonView   Capability = "addon.view"
	CapAddonManage Capability = "addon.manage"

	// Report capabilities
	CapReportView Capability = "report.view"
	CapReportHR   Capability = "report.hr"
	CapReportBill Capability = "report.billing"

	// System capabilities
	CapSystemSettings Capability = "system.settings"
	CapSystemAll      Capability = "*"
)

// String returns the string representation of the capability
func (c Capability) String() string {
	return string(c)
}






























