package rbac

// RoleCapabilityMap defines which capabilities each role has
// Based on ROLE_CAPABILITY_SPEC.md
var RoleCapabilityMap = map[Role][]Capability{
	RoleSuperAdmin: {
		CapSystemAll, // Super admin has all capabilities
	},

	RoleOwner: {
		CapTenantView,
		CapTenantUpdate,
		CapUserCreate,
		CapUserUpdate,
		CapUserView,
		CapUserDisable,
		CapUserDelete,
		CapClientCreate,
		CapClientUpdate,
		CapClientView,
		CapClientSuspend,
		CapClientDelete,
		CapBillingView,
		CapBillingCreate,
		CapBillingUpdate,
		CapBillingConfirm,
		CapNetworkView,
		CapNetworkManage,
		CapMapsView,
		CapMapsUpdate,
		CapHRView,
		CapHRManage,
		CapTechnicianView,
		CapTechnicianManage,
		CapCollectorView,
		CapCollectorManage,
		CapWAView,
		CapWASend,
		CapAddonView,
		CapAddonManage,
		CapReportView,
		CapReportHR,
		CapReportBill,
		CapSystemSettings,
	},

	RoleAdmin: {
		CapUserCreate,
		CapUserUpdate,
		CapUserView,
		CapClientCreate,
		CapClientUpdate,
		CapClientView,
		CapClientSuspend,
		CapBillingView,
		CapBillingCollect,
		CapNetworkView,
		CapNetworkManage,
		CapMapsView,
		CapMapsUpdate,
		CapTechnicianView,
		CapCollectorView,
		CapWAView,
		CapWASend,
		CapReportView,
	},

	RoleFinance: {
		CapBillingView,
		CapBillingConfirm,
		CapBillingCreate,
		CapBillingUpdate,
		CapCollectorView,
		CapClientView,
		CapReportBill,
	},

	RoleHR: {
		CapUserCreate,
		CapUserView,
		CapHRView,
		CapHRManage,
		CapReportHR,
	},

	RoleTechnician: {
		CapNetworkView,
		CapMapsView,
		CapClientView,
		CapTechnicianView,
		CapTechnicianManage,
	},

	RoleCollector: {
		CapBillingView,
		CapBillingCollect,
		CapClientView,
		CapCollectorView,
		CapCollectorManage,
	},

	RoleClient: {
		CapBillingView, // View own billing
		CapClientView,  // View own profile
	},
}

// GetCapabilities returns all capabilities for a role
func GetCapabilities(role Role) []Capability {
	caps, ok := RoleCapabilityMap[role]
	if !ok {
		return []Capability{}
	}
	return caps
}

// GetCapabilitiesForRoleString returns capabilities for a role string
func GetCapabilitiesForRoleString(roleStr string) []Capability {
	return GetCapabilities(Role(roleStr))
}






























