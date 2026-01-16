package router

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"

	"rrnet/internal/auth"
	"rrnet/internal/config"
	"rrnet/internal/health"
	"rrnet/internal/http/handler"
	"rrnet/internal/http/middleware"
	asynqInfra "rrnet/internal/infra/asynq"
	wagw "rrnet/internal/infra/wa_gateway"
	"rrnet/internal/metrics"
	"rrnet/internal/rbac"
	"rrnet/internal/repository"
	"rrnet/internal/service"
	"rrnet/internal/version"
	"rrnet/pkg/utils"
)

// Dependencies holds all dependencies required by the router
type Dependencies struct {
	Config *config.Config
	DB     *pgxpool.Pool
	Redis  *redis.Client
	Asynq  *asynq.Client
}

// New creates the HTTP router with all routes and middlewares.
// Middleware order (outermost to innermost):
// 1. RecoverPanic - Catch panics and prevent crashes
// 2. RequestID    - Inject unique request ID for tracing
// 3. RequestLogger - Log all requests with timing
// 4. TenantContext - Extract tenant from subdomain (for tenant routes)
// 5. Auth         - Verify JWT token (for protected routes)
// 6. RBAC         - Check capabilities (for protected routes)
func New(deps Dependencies) http.Handler {
	mux := http.NewServeMux()

	// ============================================
	// Initialize repositories and services
	// ============================================
	userRepo := repository.NewUserRepository(deps.DB)
	tenantRepo := repository.NewTenantRepository(deps.DB)
	planRepo := repository.NewPlanRepository(deps.DB)
	addonRepo := repository.NewAddonRepository(deps.DB)
	featureRepo := repository.NewFeatureRepository(deps.DB)

	jwtManager := auth.NewJWTManager(
		deps.Config.Auth.JWTSecret,
		deps.Config.Auth.AccessTokenTTL,
		deps.Config.Auth.RefreshTokenTTL,
	)

	clientRepo := repository.NewClientRepository(deps.DB)
	servicePackageRepo := repository.NewServicePackageRepository(deps.DB)
	clientGroupRepo := repository.NewClientGroupRepository(deps.DB)

	// Asynq client (optional injection; fallback to creating one)
	asynqClient := deps.Asynq
	if asynqClient == nil {
		asynqClient = asynqInfra.NewClient(deps.Config.Redis.Addr, deps.Config.Redis.Password, deps.Config.Redis.DB)
	}

	// Services
	authService := service.NewAuthService(userRepo, tenantRepo, jwtManager)
	planService := service.NewPlanService(planRepo, tenantRepo)
	addonService := service.NewAddonService(addonRepo, planRepo, tenantRepo)
	featureResolver := service.NewFeatureResolver(planRepo, addonRepo, featureRepo)
	limitResolver := service.NewLimitResolver(planRepo, addonRepo)
	clientService := service.NewClientService(clientRepo, servicePackageRepo, featureResolver, limitResolver, deps.Config.Auth.JWTSecret)
	servicePackageService := service.NewServicePackageService(servicePackageRepo)
	serviceSettingsService := service.NewServiceSettingsService(tenantRepo)
	clientGroupService := service.NewClientGroupService(clientGroupRepo)

	// WhatsApp campaigns (async)
	waCampaignRepo := repository.NewWACampaignRepository(deps.DB)
	waCampaignService := service.NewWACampaignService(waCampaignRepo, clientRepo, asynqClient)
	waTemplateRepo := repository.NewWATemplateRepository(deps.DB)
	waTemplateService := service.NewWATemplateService(waTemplateRepo)
	waLogRepo := repository.NewWALogRepository(deps.DB)
	waLogService := service.NewWALogService(waLogRepo)

	// Handlers
	authHandler := handler.NewAuthHandler(authService)
	planHandler := handler.NewPlanHandler(planService, featureResolver, limitResolver)
	addonHandler := handler.NewAddonHandler(addonService)
	clientHandler := handler.NewClientHandler(clientService)
	featureHandler := handler.NewFeatureHandler()
	superAdminHandler := handler.NewSuperAdminHandler(tenantRepo, planRepo, addonRepo, planService, addonService)
	employeeHandler := handler.NewEmployeeHandler(authService, userRepo)
	servicePackageHandler := handler.NewServicePackageHandler(servicePackageService)
	serviceSettingsHandler := handler.NewServiceSettingsHandler(serviceSettingsService)
	clientGroupHandler := handler.NewClientGroupHandler(clientGroupService)
	waCampaignHandler := handler.NewWACampaignHandler(waCampaignService)
	waTemplateHandler := handler.NewWATemplateHandler(waTemplateService)
	waLogHandler := handler.NewWALogHandler(waLogRepo)

	// WhatsApp Gateway (Baileys) proxy client + handler (tenant-scoped; protected)
	waGatewayClient := wagw.NewClient(deps.Config.WAGateway.URL, deps.Config.WAGateway.AdminToken)
	waGatewayHandler := handler.NewWAGatewayHandler(waGatewayClient, waLogService)

	// RBAC service
	rbacService := rbac.NewService()

	// Middleware
	requireAuth := middleware.AuthMiddleware(jwtManager)
	requireSuperAdmin := middleware.SuperAdminMiddleware(jwtManager)

	// RBAC middleware helpers
	requireCapability := func(cap rbac.Capability) func(http.Handler) http.Handler {
		return middleware.RequireCapability(rbacService, cap)
	}
	_ = func(caps ...rbac.Capability) func(http.Handler) http.Handler {
		return middleware.RequireAnyCapability(rbacService, caps...)
	}
	_ = middleware.RequireTenantAdmin()

	// Feature-gate helpers (plan/addon/toggle gating; independent from RBAC)
	requireMapsFeature := middleware.RequireAnyFeature(featureResolver, "odp_maps", "client_maps")
	requireServicePackagesFeature := middleware.RequireFeature(featureResolver, "service_packages")
	requireWAGatewayFeature := middleware.RequireFeature(featureResolver, "wa_gateway")

	// Initialize Prometheus metrics
	metrics.Init()

	// ============================================
	// Public routes (no auth required)
	// ============================================
	mux.HandleFunc("/health", method("GET", handleHealth(deps)))
	mux.HandleFunc("/version", method("GET", handleVersion))
	mux.HandleFunc("/metrics", method("GET", handleMetrics))

	// ============================================
	// API v1 routes
	// NOTE: More specific routes must be registered BEFORE /api/v1/
	// because http.ServeMux uses longest prefix matching
	// ============================================

	// Auth routes (public)
	mux.HandleFunc("/api/v1/auth/login", method("POST", authHandler.Login))
	mux.HandleFunc("/api/v1/auth/register", method("POST", authHandler.Register))
	mux.HandleFunc("/api/v1/auth/refresh", method("POST", authHandler.RefreshToken))
	mux.HandleFunc("/api/v1/auth/logout", method("POST", authHandler.Logout))

	// Feature catalog route (public - just a catalog listing)
	mux.HandleFunc("/api/v1/features", method("GET", featureHandler.List))

	// Protected routes
	mux.Handle("/api/v1/auth/me", requireAuth(methodHandler("GET", authHandler.Me)))
	mux.Handle("/api/v1/auth/change-password", requireAuth(methodHandler("POST", authHandler.ChangePassword)))

	// Tenant info route (protected)
	mux.Handle("/api/v1/tenant/me", requireAuth(methodHandler("GET", handleTenantMe(tenantRepo))))

	// ============================================
	// WhatsApp Gateway proxy routes (Protected, tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/wa-gateway/connect", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("POST", waGatewayHandler.Connect)))))
	mux.Handle("/api/v1/wa-gateway/connect/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("POST", waGatewayHandler.Connect)))))
	mux.Handle("/api/v1/wa-gateway/status", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("GET", waGatewayHandler.Status)))))
	mux.Handle("/api/v1/wa-gateway/status/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("GET", waGatewayHandler.Status)))))
	mux.Handle("/api/v1/wa-gateway/qr", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("GET", waGatewayHandler.QR)))))
	mux.Handle("/api/v1/wa-gateway/qr/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("GET", waGatewayHandler.QR)))))
	mux.Handle("/api/v1/wa-gateway/send", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("POST", waGatewayHandler.Send)))))
	mux.Handle("/api/v1/wa-gateway/send/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("POST", waGatewayHandler.Send)))))

	// ============================================
	// WhatsApp Campaigns (Protected, tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/wa-campaigns", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			waCampaignHandler.Create(w, r)
		case http.MethodGet:
			waCampaignHandler.List(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))))
	mux.Handle("/api/v1/wa-campaigns/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/wa-campaigns/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		// /{id}/retry-failed
		if strings.HasSuffix(path, "/retry-failed") {
			idStr := strings.TrimSuffix(path, "/retry-failed")
			idStr = strings.TrimSuffix(idStr, "/")
			r = setPathParam(r, "id", idStr)
			if r.Method == http.MethodPost {
				waCampaignHandler.RetryFailed(w, r)
				return
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// /{id}
		r = setPathParam(r, "id", strings.TrimSuffix(path, "/"))
		if r.Method == http.MethodGet {
			waCampaignHandler.Detail(w, r)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	})))))

	// ============================================
	// WhatsApp Templates (Protected, tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/wa-templates", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			waTemplateHandler.List(w, r)
		case http.MethodPost:
			waTemplateHandler.Create(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))))
	mux.Handle("/api/v1/wa-templates/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/wa-templates/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", strings.TrimSuffix(path, "/"))
		switch r.Method {
		case http.MethodPut, http.MethodPatch:
			waTemplateHandler.Update(w, r)
		case http.MethodDelete:
			waTemplateHandler.Delete(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))))

	// ============================================
	// WhatsApp Logs (Protected, tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/wa-logs", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("GET", waLogHandler.List)))))
	mux.Handle("/api/v1/wa-logs/", requireAuth(requireWAGatewayFeature(requireCapability(rbac.CapWAView)(methodHandler("GET", waLogHandler.List)))))

	// ============================================
	// Plan routes (Super Admin only for CRUD, tenant admin can view via /api/v1/my/plan)
	// ============================================
	// Use requireSuperAdmin (checks TenantID == uuid.Nil) for consistency with other super admin routes
	mux.Handle("/api/v1/plans", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			planHandler.List(w, r)
		case http.MethodPost:
			planHandler.Create(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Plan detail routes - protected with super admin middleware (checks TenantID == uuid.Nil)
	planDetailHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract plan ID from path: /api/v1/plans/{id}
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/plans/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		// Inject path value via context
		r = setPathParam(r, "id", path)

		switch r.Method {
		case http.MethodGet:
			planHandler.Get(w, r)
		case http.MethodPut, http.MethodPatch:
			// Support both PUT and PATCH for update
			planHandler.Update(w, r)
		case http.MethodDelete:
			planHandler.Delete(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
	// Apply super admin middleware - checks TenantID == uuid.Nil (same as /api/v1/superadmin/tenants)
	mux.Handle("/api/v1/plans/", requireSuperAdmin(planDetailHandler))

	// Tenant plan assignment (Admin)
	mux.HandleFunc("/api/v1/tenants/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/tenants/")
		parts := strings.Split(path, "/")
		if len(parts) < 2 {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		tenantID := parts[0]
		action := parts[1]
		r = setPathParam(r, "tenant_id", tenantID)

		switch action {
		case "plan":
			switch r.Method {
			case http.MethodPost:
				planHandler.AssignToTenant(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
		case "addons":
			switch r.Method {
			case http.MethodPost:
				addonHandler.AssignToTenant(w, r)
			case http.MethodGet:
				// Get tenant addons by tenant_id (for admin)
				w.WriteHeader(http.StatusNotImplemented)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	})

	// ============================================
	// Addon routes (Admin)
	// ============================================
	mux.HandleFunc("/api/v1/addons", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			addonHandler.List(w, r)
		case http.MethodPost:
			addonHandler.Create(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/v1/addons/", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/addons/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			addonHandler.Get(w, r)
		case http.MethodPut:
			addonHandler.Update(w, r)
		case http.MethodDelete:
			addonHandler.Delete(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// ============================================
	// Billing service initialization (needed for client routes)
	// ============================================
	invoiceRepo := repository.NewInvoiceRepository(deps.DB)
	paymentRepo := repository.NewPaymentRepository(deps.DB)
	billingService := service.NewBillingService(invoiceRepo, paymentRepo, clientRepo, servicePackageRepo)
	billingHandler := handler.NewBillingHandler(billingService)

	tempoTemplateRepo := repository.NewBillingTempoTemplateRepository(deps.DB)
	tempoTemplateService := service.NewBillingTempoTemplateService(tempoTemplateRepo)
	tempoTemplateHandler := handler.NewBillingTempoTemplateHandler(tempoTemplateService)

	// ============================================
	// Client routes (Protected, tenant-scoped, requires client capabilities)
	// ============================================
	mux.Handle("/api/v1/clients", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapClientView)(http.HandlerFunc(clientHandler.List)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapClientCreate)(http.HandlerFunc(clientHandler.Create)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/clients/stats", requireAuth(methodHandler("GET", clientHandler.GetStats)))
	mux.Handle("/api/v1/clients/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/clients/")
		if path == "" || path == "stats" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		parts := strings.Split(path, "/")
		r = setPathParam(r, "id", parts[0])

		// Check for billing routes: /api/v1/clients/{id}/invoices
		if len(parts) >= 2 && parts[1] == "invoices" {
			r = setPathParam(r, "client_id", parts[0])
			if r.Method == http.MethodGet {
				billingHandler.GetClientPendingInvoices(w, r)
			} else if r.Method == http.MethodPost && len(parts) == 3 && parts[2] == "generate" {
				billingHandler.GenerateMonthlyInvoice(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		// Check for status change: /api/v1/clients/{id}/status
		if len(parts) == 2 && parts[1] == "status" {
			if r.Method == http.MethodPatch {
				clientHandler.ChangeStatus(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		// Client CRUD operations
		switch r.Method {
		case http.MethodGet:
			clientHandler.Get(w, r)
		case http.MethodPut:
			clientHandler.Update(w, r)
		case http.MethodDelete:
			clientHandler.Delete(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// ============================================
	// Tenant feature/limit routes (Protected, tenant context)
	// ============================================
	mux.Handle("/api/v1/my/plan", requireAuth(methodHandler("GET", planHandler.GetTenantPlan)))
	mux.Handle("/api/v1/my/features", requireAuth(methodHandler("GET", planHandler.GetTenantFeatures)))
	mux.Handle("/api/v1/my/limits", requireAuth(methodHandler("GET", planHandler.GetTenantLimits)))
	mux.Handle("/api/v1/my/addons", requireAuth(methodHandler("GET", addonHandler.GetTenantAddons)))
	mux.Handle("/api/v1/check/feature", requireAuth(methodHandler("GET", planHandler.CheckFeature)))
	mux.Handle("/api/v1/check/limit", requireAuth(methodHandler("GET", planHandler.CheckLimit)))

	// ============================================
	// Service setup routes (Protected, tenant-scoped, feature-gated: service_packages)
	// ============================================
	mux.Handle("/api/v1/service-packages", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			servicePackageHandler.List(w, r)
		case http.MethodPost:
			servicePackageHandler.Create(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/service-packages/", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/service-packages/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			servicePackageHandler.Get(w, r)
		case http.MethodPut:
			servicePackageHandler.Update(w, r)
		case http.MethodDelete:
			servicePackageHandler.Delete(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/service-settings", requireAuth(requireServicePackagesFeature(methodHandler("GET", serviceSettingsHandler.Get))))
	mux.Handle("/api/v1/service-settings/discount", requireAuth(requireServicePackagesFeature(methodHandler("PUT", serviceSettingsHandler.UpdateDiscount))))

	// ============================================
	// Client group routes (Protected, tenant-scoped, feature-gated: service_packages)
	// Capabilities: view=list, update=create/update/delete
	// ============================================
	mux.Handle("/api/v1/client-groups", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapClientView)(http.HandlerFunc(clientGroupHandler.List)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapClientUpdate)(http.HandlerFunc(clientGroupHandler.Create)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/client-groups/", requireAuth(requireServicePackagesFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/client-groups/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodPut:
			requireCapability(rbac.CapClientUpdate)(http.HandlerFunc(clientGroupHandler.Update)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireCapability(rbac.CapClientUpdate)(http.HandlerFunc(clientGroupHandler.Delete)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// ============================================
	// Employee routes (Protected, tenant-scoped, feature-gated: rbac_employee)
	// ============================================
	requireEmployeeFeature := middleware.RequireFeature(featureResolver, "rbac_employee")
	mux.Handle("/api/v1/employees", requireAuth(requireEmployeeFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapUserView)(http.HandlerFunc(employeeHandler.List)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapUserCreate)(http.HandlerFunc(employeeHandler.Create)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// ============================================
	// Super Admin routes (Protected, super admin only)
	// ============================================
	mux.Handle("/api/v1/superadmin/tenants", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			superAdminHandler.ListTenants(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/superadmin/tenants/", requireSuperAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/superadmin/tenants/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		parts := strings.Split(path, "/")
		tenantID := parts[0]
		r = setPathParam(r, "id", tenantID)

		// Check for nested routes: /api/v1/superadmin/tenants/{id}/suspend
		if len(parts) >= 2 {
			switch parts[1] {
			case "suspend":
				if r.Method == http.MethodPost {
					superAdminHandler.SuspendTenant(w, r)
				} else {
					w.WriteHeader(http.StatusMethodNotAllowed)
				}
				return
			case "unsuspend":
				if r.Method == http.MethodPost {
					superAdminHandler.UnsuspendTenant(w, r)
				} else {
					w.WriteHeader(http.StatusMethodNotAllowed)
				}
				return
			case "assign-plan":
				if r.Method == http.MethodPost {
					superAdminHandler.AssignPlanToTenant(w, r)
				} else {
					w.WriteHeader(http.StatusMethodNotAllowed)
				}
				return
			}
		}

		// Regular tenant CRUD operations
		switch r.Method {
		case http.MethodGet:
			superAdminHandler.GetTenant(w, r)
		case http.MethodPatch:
			superAdminHandler.UpdateTenant(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// ============================================
	// Network routes (Protected, tenant-scoped)
	// ============================================
	routerRepo := repository.NewRouterRepository(deps.DB)
	profileRepo := repository.NewNetworkProfileRepository(deps.DB)
	networkService := service.NewNetworkService(routerRepo, profileRepo)
	networkService.StartHealthCheckScheduler(context.Background())
	networkHandler := handler.NewNetworkHandler(networkService)

	// RADIUS + Voucher (Hotspot)
	voucherRepo := repository.NewVoucherRepository(deps.DB)
	voucherService := service.NewVoucherService(voucherRepo)
	radiusRepo := repository.NewRadiusRepository(deps.DB)
	// RADIUS shared secret from env (for FreeRADIUS rlm_rest authentication)
	// Must match FreeRADIUS env: RRNET_RADIUS_REST_SECRET (see infra/freeradius + docker-compose).
	radiusSecret := utils.GetEnv("RRNET_RADIUS_REST_SECRET", "dev-radius-rest-secret")
	radiusHandler := handler.NewRadiusHandler(routerRepo, voucherService, radiusRepo, radiusSecret)
	voucherHandler := handler.NewVoucherHandler(voucherService)

	// Routers
	mux.Handle("/api/v1/network/routers", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapNetworkView)(http.HandlerFunc(networkHandler.ListRouters)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.CreateRouter)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/network/routers/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/network/routers/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		path = strings.TrimSuffix(path, "/")
		parts := strings.Split(path, "/")

		// 1. Provision (POST /api/v1/network/routers/provision)
		if path == "provision" {
			if r.Method == http.MethodPost {
				requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.ProvisionRouter)).ServeHTTP(w, r)
				return
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// 2. Test Router Config (POST /api/v1/network/routers/test-config)
		if path == "test-config" {
			if r.Method == http.MethodPost {
				requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.TestRouterConfig)).ServeHTTP(w, r)
				return
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// 3. ID-specific routes
		if len(parts) == 2 {
			id := parts[0]
			action := parts[1]
			r = setPathParam(r, "id", id)

			switch action {
			case "test-connection":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkView)(http.HandlerFunc(networkHandler.TestRouterConnection)).ServeHTTP(w, r)
					return
				}
			case "disconnect":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.DisconnectRouter)).ServeHTTP(w, r)
					return
				}
			case "remote-access":
				if r.Method == http.MethodPost {
					requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.ToggleRemoteAccess)).ServeHTTP(w, r)
					return
				}
			}
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		// 4. CRUD on specific ID
		if len(parts) == 1 {
			r = setPathParam(r, "id", parts[0])
			switch r.Method {
			case http.MethodGet:
				requireCapability(rbac.CapNetworkView)(http.HandlerFunc(networkHandler.GetRouter)).ServeHTTP(w, r)
			case http.MethodPut:
				requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.UpdateRouter)).ServeHTTP(w, r)
			case http.MethodDelete:
				requireCapability(rbac.CapNetworkManage)(http.HandlerFunc(networkHandler.DeleteRouter)).ServeHTTP(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		w.WriteHeader(http.StatusNotFound)
	})))

	// Network Profiles
	mux.Handle("/api/v1/network/profiles", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			networkHandler.ListProfiles(w, r)
		case http.MethodPost:
			networkHandler.CreateProfile(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/network/profiles/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/network/profiles/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			networkHandler.GetProfile(w, r)
		case http.MethodPut:
			networkHandler.UpdateProfile(w, r)
		case http.MethodDelete:
			networkHandler.DeleteProfile(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// ============================================
	// RADIUS routes (PUBLIC - protected by shared secret header only)
	// These endpoints are called by FreeRADIUS rlm_rest
	// ============================================
	mux.Handle("/api/v1/radius/auth", methodHandler("POST", radiusHandler.Auth))
	mux.Handle("/api/v1/radius/acct", methodHandler("POST", radiusHandler.Acct))

	// ============================================
	// Voucher routes (Protected, tenant-scoped)
	// ============================================
	mux.Handle("/api/v1/voucher-packages", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			voucherHandler.ListPackages(w, r)
		case http.MethodPost:
			voucherHandler.CreatePackage(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/voucher-packages/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/voucher-packages/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			voucherHandler.GetPackage(w, r)
		case http.MethodPut:
			voucherHandler.UpdatePackage(w, r)
		case http.MethodDelete:
			voucherHandler.DeletePackage(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/v1/vouchers", requireAuth(methodHandler("GET", voucherHandler.ListVouchers)))
	mux.Handle("/api/v1/vouchers/generate", requireAuth(methodHandler("POST", voucherHandler.GenerateVouchers)))

	// RADIUS audit routes (Protected, tenant-scoped)
	mux.Handle("/api/v1/radius/auth-attempts", requireAuth(methodHandler("GET", radiusHandler.ListAuthAttempts)))
	mux.Handle("/api/v1/radius/sessions", requireAuth(methodHandler("GET", radiusHandler.ListActiveSessions)))

	// ============================================
	// Maps routes (Protected, tenant-scoped, feature-gated)
	// Requires: odp_maps OR client_maps (Business+; Enterprise via "*")
	// ============================================
	odcRepo := repository.NewODCRepository(deps.DB)
	odpRepo := repository.NewODPRepository(deps.DB)
	clientLocRepo := repository.NewClientLocationRepository(deps.DB)
	outageRepo := repository.NewOutageRepository(deps.DB)
	topologyRepo := repository.NewTopologyRepository(deps.DB)
	mapsService := service.NewMapsService(odcRepo, odpRepo, clientLocRepo, outageRepo, topologyRepo)
	mapsHandler := handler.NewMapsHandler(mapsService)

	// ODCs
	mux.Handle("/api/v1/maps/odcs", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.ListODCs)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.CreateODC)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/maps/odcs/", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/maps/odcs/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		parts := strings.Split(path, "/")
		r = setPathParam(r, "id", parts[0])
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.GetODC)).ServeHTTP(w, r)
		case http.MethodPut, http.MethodPatch:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.UpdateODC)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.DeleteODC)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// ODPs
	mux.Handle("/api/v1/maps/odps", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.ListODPs)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.CreateODP)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/maps/odps/", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/maps/odps/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		parts := strings.Split(path, "/")
		r = setPathParam(r, "id", parts[0])
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.GetODP)).ServeHTTP(w, r)
		case http.MethodPut, http.MethodPatch:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.UpdateODP)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.DeleteODP)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// Client locations
	mux.Handle("/api/v1/maps/clients/nearest-odp", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.FindNearestODP)).ServeHTTP(w, r)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	}))))
	mux.Handle("/api/v1/maps/clients", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.ListClientLocations)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.CreateClientLocation)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/maps/clients/", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/maps/clients/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		parts := strings.Split(path, "/")
		r = setPathParam(r, "id", parts[0])
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.GetClientLocation)).ServeHTTP(w, r)
		case http.MethodPut, http.MethodPatch:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.UpdateClientLocation)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.DeleteClientLocation)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// Outages
	mux.Handle("/api/v1/maps/outages", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.ListOutages)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.ReportOutage)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/v1/maps/outages/", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/maps/outages/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		parts := strings.Split(path, "/")
		r = setPathParam(r, "id", parts[0])
		// POST /api/v1/maps/outages/{id}/resolve
		if len(parts) == 2 && parts[1] == "resolve" {
			if r.Method == http.MethodPost {
				requireCapability(rbac.CapMapsUpdate)(http.HandlerFunc(mapsHandler.ResolveOutage)).ServeHTTP(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}
		// GET /api/v1/maps/outages/{id}
		if r.Method == http.MethodGet {
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.GetOutage)).ServeHTTP(w, r)
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	}))))

	// Topology
	mux.Handle("/api/v1/maps/topology", requireAuth(requireMapsFeature(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			requireCapability(rbac.CapMapsView)(http.HandlerFunc(mapsHandler.GetTopology)).ServeHTTP(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))))

	// ============================================
	// Billing routes (Protected, tenant-scoped)
	// ============================================
	// Invoices
	mux.Handle("/api/v1/billing/invoices", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			billingHandler.ListInvoices(w, r)
		case http.MethodPost:
			billingHandler.CreateInvoice(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/billing/invoices/overdue", requireAuth(methodHandler("GET", billingHandler.GetOverdueInvoices)))
	mux.Handle("/api/v1/billing/invoices/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/billing/invoices/")
		parts := strings.Split(path, "/")
		if len(parts) == 0 || parts[0] == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", parts[0])

		if len(parts) == 2 && parts[1] == "payments" {
			r = setPathParam(r, "invoice_id", parts[0])
			if r.Method == http.MethodGet {
				billingHandler.GetInvoicePayments(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}
		if len(parts) == 2 && parts[1] == "cancel" {
			if r.Method == http.MethodPost {
				billingHandler.CancelInvoice(w, r)
			} else {
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
			return
		}

		switch r.Method {
		case http.MethodGet:
			billingHandler.GetInvoice(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Payments
	mux.Handle("/api/v1/billing/payments", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			billingHandler.ListPayments(w, r)
		case http.MethodPost:
			billingHandler.RecordPayment(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/billing/payments/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/billing/payments/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodGet:
			billingHandler.GetPayment(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// Billing Summary
	mux.Handle("/api/v1/billing/summary", requireAuth(methodHandler("GET", billingHandler.GetBillingSummary)))

	// Payment Matrix (12-month view)
	mux.Handle("/api/v1/billing/payment-matrix", requireAuth(methodHandler("GET", billingHandler.GetPaymentMatrix)))

	// Tempo Templates (tenant-scoped, RBAC: billing.view/list, billing.update for mutations)
	mux.Handle("/api/v1/billing/tempo-templates", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			requireCapability(rbac.CapBillingView)(http.HandlerFunc(tempoTemplateHandler.List)).ServeHTTP(w, r)
		case http.MethodPost:
			requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(tempoTemplateHandler.Create)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/v1/billing/tempo-templates/", requireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/v1/billing/tempo-templates/")
		if path == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		r = setPathParam(r, "id", path)
		switch r.Method {
		case http.MethodPut:
			requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(tempoTemplateHandler.Update)).ServeHTTP(w, r)
		case http.MethodDelete:
			requireCapability(rbac.CapBillingUpdate)(http.HandlerFunc(tempoTemplateHandler.Delete)).ServeHTTP(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})))

	// ============================================
	// API Root (must be last to avoid catching all /api/v1/* routes)
	// ============================================
	mux.HandleFunc("/api/v1/", method("GET", handleAPIRoot))

	// ============================================
	// Apply global middlewares
	// Order matters! Applied bottom-to-top (last applied runs first)
	// ============================================
	var finalHandler http.Handler = mux

	// 9. TenantContext - Extract tenant from subdomain
	finalHandler = middleware.TenantContext(tenantRepo)(finalHandler)

	// 8. Rate Limiting - Per-tenant and per-IP rate limiting
	// Configure rate limits (default: 100 requests per minute)
	defaultLimit := 100
	defaultWindow := 1 * time.Minute
	rateLimiter := middleware.NewRateLimiter(deps.Redis, defaultLimit, defaultWindow)

	// Set stricter limits for auth endpoints
	rateLimiter.SetEndpointLimit("/api/v1/auth/login", 5, 1*time.Minute)
	rateLimiter.SetEndpointLimit("/api/v1/auth/register", 3, 1*time.Minute)
	rateLimiter.SetEndpointLimit("/api/v1/auth/refresh", 10, 1*time.Minute)

	// WhatsApp gateway UI polls status/qr; allow higher throughput for these endpoints
	// (still scoped by tenant/user/ip via RateLimiter.getClientIdentifier)
	rateLimiter.SetEndpointLimit("/api/v1/wa-gateway/", 600, 1*time.Minute)
	// Keep connect endpoint lower to avoid accidental spam
	rateLimiter.SetEndpointLimit("/api/v1/wa-gateway/connect", 30, 1*time.Minute)
	rateLimiter.SetEndpointLimit("/api/v1/wa-gateway/connect/", 30, 1*time.Minute)

	finalHandler = rateLimiter.RateLimitMiddleware(finalHandler)

	// 7. CSRF Protection - Protect state-changing operations
	csrfProtection := middleware.DefaultCSRFProtection()
	finalHandler = csrfProtection.CSRFMiddleware(finalHandler)

	// 6. RequestLogger - Log all requests
	finalHandler = middleware.RequestLogger(finalHandler)

	// 5. RequestID - Inject unique request ID
	finalHandler = middleware.RequestID(finalHandler)

	// 4. Input Validation - Validate request input with configurable limits
	requestSizeLimits := middleware.NewRequestSizeLimits(
		deps.Config.Server.MaxRequestSize,
		deps.Config.Server.MaxJSONSize,
		deps.Config.Server.MaxMultipartSize,
	)
	finalHandler = middleware.InputValidationMiddleware(requestSizeLimits)(finalHandler)

	// 3. CORS - Handle cross-origin requests
	corsConfig := middleware.DefaultCORSConfig()
	finalHandler = middleware.CORS(corsConfig)(finalHandler)

	// 2. Security Headers - Add security headers to all responses
	finalHandler = middleware.SecurityHeaders(finalHandler)

	// 1. RecoverPanic - Must be outermost to catch all panics
	finalHandler = middleware.RecoverPanic(finalHandler)

	return finalHandler
}

// handleHealth returns the health check handler
func handleHealth(deps Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := health.Check(r.Context(), deps.DB, deps.Redis)

		w.Header().Set("Content-Type", "application/json")
		if status.Status != "healthy" {
			w.WriteHeader(http.StatusServiceUnavailable)
		}

		_ = json.NewEncoder(w).Encode(status)
	}
}

// handleVersion returns the version info handler
func handleVersion(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(version.Get())
}

// handleMetrics returns the Prometheus metrics handler
func handleMetrics(w http.ResponseWriter, r *http.Request) {
	metrics.Handler().ServeHTTP(w, r)
}

// handleAPIRoot returns the API root handler
func handleAPIRoot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "RRNET API v1",
		"status":  "ready",
	})
}

// method wraps a handler func to enforce HTTP method.
func method(expected string, fn http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != expected {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		fn(w, r)
	}
}

// methodHandler adapts to http.Handler
func methodHandler(expected string, fn http.HandlerFunc) http.Handler {
	return http.HandlerFunc(method(expected, fn))
}

// handleTenantMe returns the current tenant info handler
func handleTenantMe(tenantRepo *repository.TenantRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get tenant ID from auth context
		tenantID, ok := auth.GetTenantID(r.Context())
		if !ok || tenantID == (uuid.UUID{}) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "No tenant context",
			})
			return
		}

		tenant, err := tenantRepo.GetByID(r.Context(), tenantID)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": "Tenant not found",
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"id":             tenant.ID,
			"name":           tenant.Name,
			"slug":           tenant.Slug,
			"status":         tenant.Status,
			"billing_status": tenant.BillingStatus,
		})
	}
}

// setPathParam sets a path parameter in the request context
func setPathParam(r *http.Request, key, value string) *http.Request {
	params, ok := r.Context().Value(handler.PathParamsKey).(map[string]string)
	if !ok || params == nil {
		params = make(map[string]string)
	}
	params[key] = value
	ctx := context.WithValue(r.Context(), handler.PathParamsKey, params)
	return r.WithContext(ctx)
}
